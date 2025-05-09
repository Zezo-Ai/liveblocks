module.exports = {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-order", "stylelint-plugin-logical-css"],
  rules: {
    "custom-property-pattern": /^(lb|frimousse)-[a-z-]+$/,
    "selector-class-pattern": /^lb-[a-z-:]+$/,
    "keyframes-name-pattern": /^lb-[a-z-:]+$/,
    "selector-max-specificity": "0,1,1",
    "keyframe-block-no-duplicate-selectors": null,
    "import-notation": "string",
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          // Custom at-rules from postcss-advanced-variables
          "mixin",
          "include",
          "content",
          "if",
          "else",
          "for",
          "each",
        ],
      },
    ],
    "function-no-unknown": [
      true,
      {
        ignoreFunctions: [
          // Custom functions added via postcss-functions
          "color-mix-scale",
        ],
      },
    ],
    "order/order": [
      ["dollar-variables", "custom-properties", "declarations", "rules"],
    ],
    "order/properties-order": [
      [
        "all",
        "content",
        "position",
        "inset",
        "inset-inline",
        "inset-inline-end",
        "inset-inline-start",
        "inset-block",
        "inset-block-end",
        "inset-block-start",
        "z-index",
        "container",
        "container-name",
        "container-type",
        "display",
        "vertical-align",
        "flex",
        "flex-grow",
        "flex-shrink",
        "flex-basis",
        "flex-direction",
        "flex-flow",
        "flex-wrap",
        "grid",
        "grid-area",
        "grid-template",
        "grid-template-areas",
        "grid-template-rows",
        "grid-template-columns",
        "grid-row",
        "grid-row-start",
        "grid-row-end",
        "grid-column",
        "grid-column-start",
        "grid-column-end",
        "grid-auto-rows",
        "grid-auto-columns",
        "grid-auto-flow",
        "grid-gap",
        "grid-row-gap",
        "grid-column-gap",
        "gap",
        "row-gap",
        "column-gap",
        "place-content",
        "align-content",
        "justify-content",
        "place-items",
        "align-items",
        "justify-items",
        "place-self",
        "align-self",
        "justify-self",
        "order",
        "float",
        "clear",
        "object-fit",
        "object-position",
        "overflow",
        "overflow-inline",
        "overflow-block",
        "overflow-scrolling",
        "clip",
        "box-sizing",
        "aspect-ratio",
        "inline-size",
        "min-inline-size",
        "max-inline-size",
        "block-size",
        "min-block-size",
        "max-block-size",
        "margin",
        "margin-inline",
        "margin-inline-start",
        "margin-inline-end",
        "margin-block",
        "margin-block-start",
        "margin-block-end",
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
        "padding",
        "padding-inline",
        "padding-inline-start",
        "padding-inline-end",
        "padding-block",
        "padding-block-start",
        "padding-block-end",
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
        "border",
        "border-spacing",
        "border-collapse",
        "border-width",
        "border-style",
        "border-color",
        "border-inline",
        "border-inline-width",
        "border-inline-style",
        "border-inline-color",
        "border-inline-start",
        "border-inline-start-width",
        "border-inline-start-style",
        "border-inline-start-color",
        "border-inline-end",
        "border-inline-end-width",
        "border-inline-end-style",
        "border-inline-end-color",
        "border-block",
        "border-block-width",
        "border-block-style",
        "border-block-color",
        "border-block-start",
        "border-block-start-width",
        "border-block-start-style",
        "border-block-start-color",
        "border-block-end",
        "border-block-end-width",
        "border-block-end-style",
        "border-block-end-color",
        "border-radius",
        "border-start-start-radius",
        "border-start-end-radius",
        "border-end-start-radius",
        "border-end-end-radius",
        "background",
        "background-color",
        "background-image",
        "background-attachment",
        "background-position",
        "background-position-x",
        "background-position-y",
        "background-clip",
        "background-origin",
        "background-size",
        "background-repeat",
        "color",
        "box-decoration-break",
        "box-shadow",
        "outline",
        "outline-width",
        "outline-style",
        "outline-color",
        "outline-offset",
        "table-layout",
        "caption-side",
        "empty-cells",
        "list-style",
        "list-style-position",
        "list-style-type",
        "list-style-image",
        "font",
        "font-weight",
        "font-style",
        "font-variant",
        "font-size-adjust",
        "font-stretch",
        "font-size",
        "font-family",
        "src",
        "line-height",
        "letter-spacing",
        "quotes",
        "counter-increment",
        "counter-reset",
        "text-align",
        "text-align-last",
        "text-decoration",
        "text-emphasis",
        "text-emphasis-position",
        "text-emphasis-style",
        "text-emphasis-color",
        "text-indent",
        "text-justify",
        "text-outline",
        "text-transform",
        "text-wrap",
        "text-overflow",
        "text-overflow-ellipsis",
        "text-overflow-mode",
        "text-shadow",
        "white-space",
        "word-spacing",
        "word-wrap",
        "word-break",
        "overflow-wrap",
        "tab-size",
        "hyphens",
        "interpolation-mode",
        "opacity",
        "visibility",
        "filter",
        "resize",
        "cursor",
        "pointer-events",
        "user-select",
        "unicode-bidi",
        "direction",
        "columns",
        "column-span",
        "column-width",
        "column-count",
        "column-fill",
        "column-gap",
        "column-rule",
        "column-rule-width",
        "column-rule-style",
        "column-rule-color",
        "break-before",
        "break-inside",
        "break-after",
        "page-break-before",
        "page-break-inside",
        "page-break-after",
        "orphans",
        "widows",
        "zoom",
        "max-zoom",
        "min-zoom",
        "user-zoom",
        "orientation",
        "fill",
        "stroke",
        "transition",
        "transition-delay",
        "transition-timing-function",
        "transition-duration",
        "transition-property",
        "transform",
        "transform-origin",
        "animation",
        "animation-name",
        "animation-duration",
        "animation-play-state",
        "animation-timing-function",
        "animation-delay",
        "animation-iteration-count",
        "animation-direction",
        "animation-fill-mode",
      ],
      {
        unspecified: "bottom",
      },
    ],
    "plugin/use-logical-properties-and-values": true,
    "plugin/use-logical-units": true,
  },
};
