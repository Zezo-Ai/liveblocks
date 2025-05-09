import type {
  ArrayType,
  BooleanType,
  Definition,
  Document,
  FieldDef,
  Identifier,
  LiteralType,
  LiveMapType,
  LiveType,
  NonUnionType,
  NumberType,
  ObjectLiteralType,
  ObjectTypeDefinition,
  Range,
  StringType,
  Type,
  TypeName,
  TypeRef,
  UnionType,
} from "../ast";
import { defineMethod, isLiveType, isScalarType } from "../ast";
import { assertNever } from "../lib/assert";
import { didyoumean as dym } from "../lib/didyoumean";
import type { ErrorReporter, Suggestion } from "../lib/error-reporting";
import { prettify } from "../prettify";

declare module "../ast/index.js" {
  interface Semantics {
    check(context: Context): void;
  }
}

defineMethod("check", {
  ArrayType: checkArrayType,
  Identifier: checkIdentifier,
  LiteralType: checkLiteralType,
  LiveMapType: checkLiveMapType,
  ObjectLiteralType: checkObjectLiteralType,
  ObjectTypeDefinition: checkObjectTypeDefinition,
  TypeName: checkTypeName,
  TypeRef: checkTypeRef,
  UnionType: checkUnionType,

  Node: () => {},
  afterEach: (node, context) => {
    for (const child of node.children) {
      child.check(context);
    }
  },
});

function quote(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

const TYPENAME_REGEX = /^[A-Z_]/;

// TODO Ideally _derive_ this list of builtins directly from the grammar
// instead somehow?
const BUILTINS = ["string", "number", "boolean", "null"] as const;

function suggest_general(value: string, alternatives: string[]): string[] {
  // Never suggest "Storage"
  alternatives = alternatives.filter((key) => key !== "Storage");
  return dym(value, alternatives);
}

/**
 * Whether a type expression is a generic LiveXxx<> type.
 */
function isLiveStructure(node: Type): node is LiveType | TypeRef {
  return (
    // LiveList<...>, or LiveMap<...>
    isLiveType(node) ||
    // e.g. LiveObject<...>
    (node._kind === "TypeRef" && node.asLiveObject)
  );
}

function didyoumeanify(message: string, alternatives: string[]): string {
  if (alternatives.length === 0) {
    return message;
  }
  if (message.endsWith(".")) {
    message = message.slice(0, -1);
  }
  return `${message}. Did you mean ${alternatives.map(quote).join(" or ")}?`;
}

/**
 * Reserve these names for future use.
 */
const RESERVED_TYPENAMES_REGEX =
  /^live|^(presence|array|string|int|float|number|boolean|null)$/i;

/**
 * Reserve these identifiers for future use.
 */
const RESERVED_IDENTIFIERS_REGEX = /^(liveblocksType)$/;

/**
 * Helper constructs for use during "checking" phase.
 */
class Context {
  errorReporter: ErrorReporter;

  // A registry of user-defined types by their identifier names. Defined during
  // the first checkDocument pass.
  registeredTypes: Map<string, Definition>;

  // Maintain a list of unreferenced definitions. If at the end of the checking
  // phase, this thing still contains any entries, we throw an error.
  unreferencedDefs: Set<Definition>;

  readonly suggestors = {
    objectTypeName: (name: string): string[] =>
      suggest_general(
        name,
        Array.from(this.registeredTypes)
          .filter(([, def]) => def._kind === "ObjectTypeDefinition")
          .map(([key]) => key)
      ),

    typeNameOrBuiltIn: (name: string): string[] =>
      suggest_general(name, [
        ...Array.from(this.registeredTypes.keys()),
        ...BUILTINS,
      ]),
  };

  constructor(errorReporter: ErrorReporter) {
    this.errorReporter = errorReporter;
    this.registeredTypes = new Map();
    this.unreferencedDefs = new Set();
  }

  //
  // Convenience helpers
  //

  lineno(range?: Range): string {
    if (range === undefined) {
      return "???";
    }

    const startLine = this.errorReporter.toPosition(range[0]).line1;
    const endLine = this.errorReporter.toPosition(range[1]).line1;
    if (startLine === endLine) {
      return `${startLine}`;
    } else {
      return `${startLine}–${endLine}`;
    }
  }

  getDefinition(typeRef: TypeRef): Definition {
    const def = this.registeredTypes.get(typeRef.ref.name);
    if (def === undefined) {
      this.report(
        `Unknown type name ${quote(typeRef.ref.name)}`,
        typeRef.ref.range
      );
      throw new Error(`Unknown type name "${typeRef.ref.name}"`);
    }
    return def;
  }

  report(title: string, range: Range, suggestions?: Suggestion[]): void {
    // FIXME(nvie) Don't throw on the first error! Collect a few (max 3?) and then throw as one error.
    // this.errorReporter.printSemanticError(title, description, range);
    this.errorReporter.throwSemanticError(title, range, suggestions);
  }
}

function formatReplaceSuggestions(suggestions: string[]): Suggestion[] {
  return suggestions.map((suggestion) => ({
    type: "replace",
    name: suggestion,
  }));
}

function dupes<T, K extends string | number>(
  items: Iterable<T>,
  keyFn: (item: T) => K
): [T, T][] {
  const seen = new Map<K, T>();

  const dupes: [T, T][] = [];
  for (const item of items) {
    const key = keyFn(item);
    const existing = seen.get(key);
    if (existing !== undefined) {
      dupes.push([existing, item]);
    } else {
      seen.set(key, item);
    }
  }

  return dupes;
}

function checkNoDuplicateFields(fieldDefs: FieldDef[], context: Context): void {
  // Check for any duplicate field names
  for (const [first, second] of dupes(fieldDefs, (f) => f.name.name)) {
    context.report(
      `A field named ${quote(
        first.name.name
      )} is defined multiple times (on line ${context.lineno(
        first.name.range
      )} and ${context.lineno(second.name.range)})`,
      second.name.range
    );
  }
}

function ensureNoLiveStructure(expr: Type, where: string, context: Context) {
  if (isLiveStructure(expr)) {
    context.report(`Cannot use Live construct ${where}`, expr.range);
  }
}

function checkObjectLiteralType(
  obj: ObjectLiteralType,
  context: Context
): void {
  checkNoDuplicateFields(obj.fields, context);

  // Check that none of the fields here use a "live" reference
  for (const field of obj.fields) {
    ensureNoLiveStructure(field.type, "inside an object literal", context);
  }
}

function checkLiteralType(lit: LiteralType, context: Context): void {
  if (typeof lit.value === "number") {
    if (!Number.isInteger(lit.value)) {
      context.report("Number literals can only be whole integers", lit.range);
    }
  }
}

function checkArrayType(arr: ArrayType, context: Context): void {
  ensureNoLiveStructure(arr.ofType, "inside an array", context);
}

function checkTypeName(node: TypeName, context: Context): void {
  if (BUILTINS.some((bname) => bname === node.name)) {
    context.report(
      `Name ${quote(node.name)} is a built-in and cannot be redefined`,
      node.range
    );
  }

  if (!TYPENAME_REGEX.test(node.name)) {
    context.report(
      "Type names should start with an uppercase character",
      node.range
    );
  }

  if (!context.errorReporter.hasErrors) {
    if (RESERVED_TYPENAMES_REGEX.test(node.name)) {
      context.report(
        `Name ${quote(node.name)} is reserved for future use`,
        node.range
      );
    }
  }
}

function checkIdentifier(node: Identifier, context: Context): void {
  if (RESERVED_IDENTIFIERS_REGEX.test(node.name)) {
    context.report(`Identifier ${quote(node.name)} is reserved`, node.range);
  }
}

function checkTypeNameExists(
  node: TypeName,
  context: Context,
  suggestor: (name: string) => string[]
): void {
  if (context.registeredTypes.has(node.name)) {
    return;
  }
  const suggestions = suggestor(node.name);
  context.report(
    didyoumeanify(`Unknown type ${quote(node.name)}`, suggestor(node.name)),
    node.range,
    formatReplaceSuggestions(suggestions)
  );
}

function checkTypeRefTarget(node: TypeRef, context: Context): void {
  if (node.asLiveObject) {
    checkTypeNameIsObjectType(node.ref, context);
    checkTypeNameExists(node.ref, context, context.suggestors.objectTypeName);
  } else {
    checkTypeNameExists(
      node.ref,
      context,
      context.suggestors.typeNameOrBuiltIn
    );
  }
}

function checkTypeNameIsObjectType(node: TypeName, context: Context): void {
  const def = context.registeredTypes.get(node.name);
  if (!def) {
    const suggestions = context.suggestors.objectTypeName(node.name);
    context.report(
      didyoumeanify(`Unknown object type ${quote(node.name)}`, suggestions),
      node.range,
      formatReplaceSuggestions(suggestions)
    );
    return;
  }

  // Check that the payload of a LiveObject type is an object type
  if (def._kind !== "ObjectTypeDefinition") {
    const suggestions = context.suggestors.objectTypeName(node.name);
    context.report(
      didyoumeanify(
        `Type ${quote(node.name)} is not an object type`,
        suggestions
      ),
      node.range,
      formatReplaceSuggestions(suggestions)
    );
    return undefined;
  }
}

function checkTypeRef(ref: TypeRef, context: Context): void {
  checkTypeRefTarget(ref, context);

  //
  // For each definition, first ensure that it and annotate whether or not they
  // are usable in "live contexts" only. For example, in a definition like:
  //
  //   type Foo {
  //     a: LiveObject<Bar>  // or LiveList, or ...
  //   }
  //
  // It should be impossible to refer to Foo as a "normal" type, without
  // wrapping it in a Live<...> wrapper itself.
  //
  checkLiveObjectRefs(ref, context);
}

type Tag =
  | "str"
  | "num"
  | "bool"
  | "arr"
  | "obj"
  | "livemap"
  | "livelist"
  | "liveobj"
  | "null"
  | `lit:${string | number | boolean}`;

/**
 * Returns a string which acts as a "type tag": a high-level indicator that
 * uniquely defines the "tag" of a type. The purpose of this tag is fully
 * internal. It exists to define which combinations of types can legally appear
 * in union types.
 *
 * For example, both a data validator like "Int" (for only allowing whole
 * numbers) and an "number" type have a "number" tag, making them incompatible
 * to put in the same union.
 *
 * This is important because at runtime, when performing schema validation, we
 * should be able to look at an incoming value in isolation, and purely from
 * that know which member of the union it can be, so we can assign that
 * particular subschema to that value.
 *
 * Examples of ambiguous unions:
 * - number[] | string[]   because what will be the type of the the value []?
 * - LiveList<number> | LiveList<string>
 *                      because what will be the type of the the value new LiveList()?
 * - Person | { name: string; age: number }
 *                      because what will be the type of the the value { name: "Alex"; age: 30 }
 *
 * Examples of unions that are fine:
 * - number | null
 * - LiveList<string> | null
 * - string | string[]
 * - etc.
 */
function getStrictTypeTag(node: NonUnionType): Tag {
  switch (node._kind) {
    case "ArrayType":
      return "arr";

    case "ObjectLiteralType":
      return "obj";

    case "LiveMapType":
      return "livemap";

    case "LiveListType":
      return "livelist";

    case "StringType":
      return "str";

    case "NumberType":
      return "num";

    case "BooleanType":
      return "bool";

    case "NullType":
      return "null";

    case "LiteralType":
      return `lit:${JSON.stringify(node.value)}`;

    case "TypeRef":
      return node.asLiveObject ? "liveobj" : "obj";

    default:
      return assertNever(node, "Unhandled case");
  }
}

function eatWhitespaceLeft(srcText: string, pos: number): number {
  while (/[\t ]/.test(srcText.charAt(pos))) pos--;
  return pos;
}

function eatWhitespaceRight(srcText: string, pos: number): number {
  while (/[\t ]/.test(srcText.charAt(pos))) pos++;
  return pos;
}

function growToIncludePipeLeft(
  [start, end]: Range,
  srcText: string
): Range | undefined {
  start = eatWhitespaceLeft(srcText, start - 1);
  if (srcText.charAt(start) === "|") {
    start = eatWhitespaceLeft(srcText, start - 1) + 1;
    return [start, end];
  } else {
    return undefined;
  }
}

function growToIncludePipeRight(
  [start, end]: Range,
  srcText: string
): Range | undefined {
  // Try to grow to the right
  end = eatWhitespaceRight(srcText, end);
  if (srcText.charAt(end) === "|") {
    end = eatWhitespaceRight(srcText, end + 1);
    return [start, end];
  } else {
    return undefined;
  }
}

function growToIncludePipe(range: Range, context: Context): Range | undefined {
  const srcText = context.errorReporter.contents();
  return (
    growToIncludePipeLeft(range, srcText) ??
    growToIncludePipeRight(range, srcText)
  );
}

function reportIncompatibleMembers(
  member1: NonUnionType,
  member2: NonUnionType,
  context: Context
): void {
  const rangeToRemove = growToIncludePipe(member2.range, context);
  context.report(
    `Type ${quote(prettify(member2))} cannot appear in a union with ${quote(
      prettify(member1)
    )}`,
    member2.range,
    rangeToRemove !== undefined
      ? [{ type: "remove", range: rangeToRemove }]
      : []
  );
}

function checkUnionType(node: UnionType, context: Context): void {
  if (node.members.length <= 1) {
    context.report("Unions must have at least 2 members", node.range);
  }

  // On the first pass, error on any exact tag duplicates
  for (const [member1, member2] of dupes(node.members, getStrictTypeTag)) {
    const tag = getStrictTypeTag(member1);
    if (tag === "obj") {
      context.report(
        `Unions with more than one object type are not yet supported: type ${quote(
          prettify(member2)
        )} cannot appear in a union with ${quote(prettify(member1))}`,
        member2.range
      );
    } else if (tag === "liveobj") {
      context.report(
        `Unions with more than one LiveObject are not yet supported: type ${quote(
          prettify(member2)
        )} cannot appear in a union with ${quote(prettify(member1))}`,
        member2.range
      );
    } else {
      reportIncompatibleMembers(member1, member2, context);
    }
  }

  // If we get here, we know there aren't any exact duplicates, but there can
  // still be incompatibilities with literals and non-literals of the same
  // type. Let's rule these out now.

  // Keep a few flags
  let lastString: StringType | undefined; // e.g. `string`
  let lastStringLit: LiteralType | undefined; // e.g. `"hi"`
  let lastNumber: NumberType | undefined; // e.g. `number`
  let lastNumberLit: LiteralType | undefined; // e.g. `42`
  let lastBoolean: BooleanType | undefined; // e.g. `boolean`
  let lastBooleanLit: LiteralType | undefined; // e.g. `true`

  for (const member of node.members) {
    if (member._kind === "StringType") {
      lastString = member;
      if (lastStringLit) {
        reportIncompatibleMembers(lastStringLit, member, context);
      }
    } else if (member._kind === "NumberType") {
      lastNumber = member;
      if (lastNumberLit) {
        reportIncompatibleMembers(lastNumberLit, member, context);
      }
    } else if (member._kind === "BooleanType") {
      lastBoolean = member;
      if (lastBooleanLit) {
        reportIncompatibleMembers(lastBooleanLit, member, context);
      }
    } else if (member._kind === "LiteralType") {
      const type = typeof member.value;
      if (type === "string") {
        lastStringLit = member;
        if (lastString) {
          reportIncompatibleMembers(lastString, member, context);
        }
      } else if (type === "number") {
        lastNumberLit = member;
        if (lastNumber) {
          reportIncompatibleMembers(lastNumber, member, context);
        }
      } else if (type === "boolean") {
        lastBooleanLit = member;
        if (lastBoolean) {
          reportIncompatibleMembers(lastBoolean, member, context);
        }
      }
    }
  }
}

// NOTE: We can probably rewrite this using a visit(), which would save us from
// adding case statements with with every new language addition.
function checkNoForbiddenRefs(
  node: ObjectTypeDefinition | Type,
  context: Context,
  forbidden: Set<string>
): void {
  if (isScalarType(node)) {
    return;
  }

  switch (node._kind) {
    case "ObjectTypeDefinition":
      for (const field of node.fields) {
        // TODO for later. Allow _some_ self-references. For example, if
        // `field.optional`, then it'd be perfectly fine to use
        // self-references. But for reasons unrelated to the technical parsing,
        // we're currently not allowing them. See
        // https://github.com/liveblocks/liveblocks.io/issues/910 for context.
        checkNoForbiddenRefs(field.type, context, forbidden);
      }
      break;

    case "ObjectLiteralType":
      for (const field of node.fields) {
        // TODO for later. Allow _some_ self-references. For example, if
        // `field.optional`, then it'd be perfectly fine to use
        // self-references. But for reasons unrelated to the technical parsing,
        // we're currently not allowing them. See
        // https://github.com/liveblocks/liveblocks.io/issues/910 for context.
        checkNoForbiddenRefs(field.type, context, forbidden);
      }
      break;

    case "ArrayType":
    case "LiveListType":
      checkNoForbiddenRefs(node.ofType, context, forbidden);
      break;

    case "LiveMapType":
      checkNoForbiddenRefs(node.keyType, context, forbidden);
      checkNoForbiddenRefs(node.valueType, context, forbidden);
      break;

    case "TypeRef": {
      if (forbidden.has(node.ref.name)) {
        context.report(
          `Circular reference ${quote(node.ref.name)} not yet supported`,
          node.range
        );
      }

      const def = context.registeredTypes.get(node.ref.name);
      if (def !== undefined) {
        const s = new Set(forbidden);
        s.add(node.ref.name);
        checkNoForbiddenRefs(def, context, s);
      }
      break;
    }

    case "UnionType":
      for (const member of node.members) {
        checkNoForbiddenRefs(member, context, forbidden);
      }
      break;

    default:
      return assertNever(node, "Unhandled case");
  }
}

function checkLiveObjectRefs(typeRef: TypeRef, context: Context): void {
  const def = context.getDefinition(typeRef);
  if (def._kind !== "ObjectTypeDefinition") {
    // This check only checks object type definitions
    return;
  }

  // Static objects may not be referenced with LiveObject<> references
  if (def.isStatic && typeRef.asLiveObject) {
    context.report(
      `Type ${quote(def.name.name)} cannot be used with LiveObject<${quote(
        def.name.name
      )}>`,
      typeRef.range,
      [{ type: "replace", name: def.name.name }]
    );
  }

  // Live objects must be referenced with LiveObject<> references
  if (!def.isStatic && !typeRef.asLiveObject) {
    context.report(
      `Type ${quote(def.name.name)} must be referred to as ${quote(
        `LiveObject<${def.name.name}>`
      )}`,
      typeRef.range,
      [{ type: "replace", name: `LiveObject<${def.name.name}>` }]
    );
  }
}

function checkObjectTypeDefinition(
  def: ObjectTypeDefinition,
  context: Context
): void {
  checkNoDuplicateFields(def.fields, context);

  // Checks to make sure there are no self-references in object definitions
  checkNoForbiddenRefs(def, context, new Set([def.name.name]));
}

function checkLiveMapType(node: LiveMapType, context: Context): void {
  // Check that the `keyType` is always `String`, never another type
  if (node.keyType._kind !== "StringType") {
    context.report(
      "Only 'string' keys are currently supported in LiveMaps",
      node.keyType.range,
      [{ type: "replace", name: "string" }]
    );
  }
}

/**
 * This initial pass registers all type definitions found in the AST in the
 * registeredTypes registry in the context, for easy lookup.
 */
function registerTypeDefinitions(doc: Document, context: Context): void {
  // Now, first add all definitions to the global registry
  for (const def of doc.definitions) {
    const name = def.name.name;
    const existing = context.registeredTypes.get(name);
    if (existing !== undefined) {
      context.report(
        `A type named ${quote(
          name
        )} is defined multiple times (on line ${context.lineno(
          existing.name.range
        )} and ${context.lineno(def.name.range)})`,
        def.name.range
      );
    } else {
      // All good, let's register it!
      context.registeredTypes.set(name, def);
      context.unreferencedDefs.add(def);
    }
  }
}

/**
 * For all object type definitions, decide whether or not they are used in
 * static or live contexts.
 *
 * What will make an object type a "live" object type?
 *
 * 1. It uses a LiveObject, LiveList, or LiveMap construct in its definition
 * 2. All references to it use LiveObject<> wrappers
 *
 */
function decideStaticOrLive(doc: Document, context: Context): void {
  const staticObjRefs = new Map<string, TypeRef>();
  const liveObjRefs = new Map<string, TypeRef | null>();

  // First, if a definition uses a Live construct somewhere in its definition,
  // it must be a live type itself
  for (const def of context.registeredTypes.values()) {
    if (def._kind !== "ObjectTypeDefinition") continue;

    for (const sub of def.descendants) {
      if (sub._kind === "LiveListType") {
        liveObjRefs.set(def.name.name, null);
        break;
      }

      if (sub._kind === "LiveMapType") {
        liveObjRefs.set(def.name.name, null);
        break;
      }

      if (sub._kind === "TypeRef") {
        if (sub.asLiveObject) {
          liveObjRefs.set(def.name.name, null);
          break;
        }
      }
    }
  }

  // Otherwise, it's static only if all references to it don't use LiveObject<>
  for (const sub of doc.descendants) {
    if (sub._kind !== "TypeRef") continue;
    const typeRef = sub;

    const def = context.registeredTypes.get(typeRef.ref.name);
    if (def !== undefined) {
      context.unreferencedDefs.delete(def);
    }

    if (def?._kind !== "ObjectTypeDefinition") continue;

    if (typeRef.asLiveObject) {
      const conflict = staticObjRefs.get(def.name.name);
      if (conflict === undefined) {
        liveObjRefs.set(def.name.name, typeRef);
      } else {
        context.report(
          `Type ${quote(def.name.name)} already referenced as ${quote(`LiveObject<${def.name.name}>`)} on line ${context.lineno(typeRef.range)}. You cannot mix these references.`, // prettier-ignore
          conflict.range,
          [{ type: "replace", name: `LiveObject<${def.name.name}>` }]
        );
      }
    } else {
      const conflict = liveObjRefs.get(def.name.name);
      if (conflict === undefined) {
        staticObjRefs.set(def.name.name, typeRef);
      } else if (conflict === null) {
        context.report(
          `Type ${quote(def.name.name)} uses Live constructs, so it must be referenced as ${quote(`LiveObject<${def.name.name}>`)}`, // prettier-ignore
          typeRef.range,
          [{ type: "replace", name: `LiveObject<${def.name.name}>` }]
        );
      } else {
        context.report(
          `Type ${quote(def.name.name)} already referenced as ${quote(`LiveObject<${def.name.name}>`)} on line ${context.lineno(conflict.range)}. You cannot mix these references.`, // prettier-ignore
          typeRef.range,
          [{ type: "replace", name: `LiveObject<${def.name.name}>` }]
        );
      }
    }
  }

  for (const staticName of staticObjRefs.keys()) {
    const def = context.registeredTypes.get(staticName)!;
    def.isStatic = true;
  }

  for (const liveName of liveObjRefs.keys()) {
    const def = context.registeredTypes.get(liveName)!;
    def.isStatic = false;
  }
}

/**
 * The resulting AST, after the checking phase. In this datastructure, you can
 * assume that all references are intact and semantically correct.
 */
export type CheckedDocument = {
  /**
   * Direct access to the raw AST
   */
  readonly ast: Document;

  /**
   * Direct access to the root "Storage" definition.
   */
  readonly root: ObjectTypeDefinition;

  /**
   * The list of all definitions.
   */
  readonly definitions: readonly Definition[];

  /**
   * Look up the Definition of a user-defined type by a Reference to it. This
   * lookup is guaranteed to exist in the semantic check phase.
   */
  getDefinition(ref: TypeRef): Definition;
};

export function check(
  doc: Document,
  errorReporter: ErrorReporter
): CheckedDocument {
  const context = new Context(errorReporter);

  // First pass: register all definitions in the registry
  registerTypeDefinitions(doc, context);

  // Second pass: decide static/live for all object type definitions, based on
  // how they're referenced
  decideStaticOrLive(doc, context);

  // Last pass: check the entire tree
  doc.check(context);

  if (!context.registeredTypes.has("Storage")) {
    context.errorReporter.throwSemanticError(
      `Missing root object type definition named ${quote("Storage")}`,
      doc.range,
      [{ type: "add-object-type-def", name: "Storage" }]
    );
  }

  // Throw an error for every unused definition
  for (const unusedDef of context.unreferencedDefs) {
    // The one exception that is allowed to be unused
    if (unusedDef.name.name === "Storage") {
      continue;
    }

    context.report(
      `Type ${quote(unusedDef.name.name)} is defined but never used`,
      unusedDef.name.range,
      [{ type: "remove", range: unusedDef.range }]
    );
  }

  if (context.errorReporter.hasErrors) {
    throw new Error("There were errors");
  }

  return {
    ast: doc,
    root: context.registeredTypes.get("Storage") as ObjectTypeDefinition,
    definitions: Array.from(context.registeredTypes.values()),
    getDefinition(typeRef: TypeRef): Definition {
      const def = context.registeredTypes.get(typeRef.ref.name);
      if (def === undefined) {
        throw new Error(`Unknown type name "${typeRef.ref.name}"`);
      }
      return def;
    },
  };
}
