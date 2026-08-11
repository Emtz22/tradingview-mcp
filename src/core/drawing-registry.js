/**
 * Frozen TradingView drawing capability registry.
 * Evidence: Desktop runtime modules 545222, 512582, and 696238 on 2026-08-11.
 */

const entries = [
  [
    "cursor",
    {
      shape: "cursor",
      label: "Cursor",
      internalName: "cursor",
      family: "ui_mode",
      arity: null,
      route: "ui",
      finishRequired: false,
      studyTool: false,
      status: "ui_only",
      genericAllowed: false,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "dot",
    {
      shape: "dot",
      label: "Dot",
      internalName: "dot",
      family: "ui_mode",
      arity: null,
      route: "ui",
      finishRequired: false,
      studyTool: false,
      status: "ui_only",
      genericAllowed: false,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "arrow_cursor",
    {
      shape: "arrow_cursor",
      label: "Arrow Cursor",
      internalName: "arrow",
      family: "ui_mode",
      arity: null,
      route: "ui",
      finishRequired: false,
      studyTool: false,
      status: "ui_only",
      genericAllowed: false,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "eraser",
    {
      shape: "eraser",
      label: "Eraser",
      internalName: "eraser",
      family: "ui_mode",
      arity: null,
      route: "ui",
      finishRequired: false,
      studyTool: false,
      status: "ui_only",
      genericAllowed: false,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "measure",
    {
      shape: "measure",
      label: "Measure",
      internalName: "measure",
      family: "ui_mode",
      arity: null,
      route: "ui",
      finishRequired: false,
      studyTool: false,
      status: "ui_only",
      genericAllowed: false,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "zoom",
    {
      shape: "zoom",
      label: "Zoom",
      internalName: "zoom",
      family: "ui_mode",
      arity: null,
      route: "ui",
      finishRequired: false,
      studyTool: false,
      status: "ui_only",
      genericAllowed: false,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "brush",
    {
      shape: "brush",
      label: "Brush",
      internalName: "LineToolBrush",
      family: "geometry",
      arity: -1,
      minPoints: 2,
      route: "multipoint",
      finishRequired: true,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "highlighter",
    {
      shape: "highlighter",
      label: "Highlighter",
      internalName: "LineToolHighlighter",
      family: "geometry",
      arity: -1,
      minPoints: 2,
      route: "multipoint",
      finishRequired: true,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "text",
    {
      shape: "text",
      label: "Text",
      internalName: "LineToolText",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "anchored_text",
    {
      shape: "anchored_text",
      label: "Anchored Text",
      internalName: "LineToolTextAbsolute",
      family: "annotation",
      arity: 1,
      route: "anchored",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "note",
    {
      shape: "note",
      label: "Pin",
      internalName: "LineToolNote",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "text_note",
    {
      shape: "text_note",
      label: "Note",
      internalName: "LineToolTextNote",
      family: "annotation",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "anchored_note",
    {
      shape: "anchored_note",
      label: "Anchored Note",
      internalName: "LineToolNoteAbsolute",
      family: "annotation",
      arity: 1,
      route: "anchored",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "signpost",
    {
      shape: "signpost",
      label: "Signpost",
      internalName: "LineToolSignpost",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "callout",
    {
      shape: "callout",
      label: "Callout",
      internalName: "LineToolCallout",
      family: "annotation",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "balloon",
    {
      shape: "balloon",
      label: "Balloon",
      internalName: "LineToolBalloon",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "comment",
    {
      shape: "comment",
      label: "Comment",
      internalName: "LineToolComment",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "arrow_up",
    {
      shape: "arrow_up",
      label: "Arrow mark up",
      internalName: "LineToolArrowMarkUp",
      family: "marker",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "arrow_down",
    {
      shape: "arrow_down",
      label: "Arrow mark down",
      internalName: "LineToolArrowMarkDown",
      family: "marker",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "price_label",
    {
      shape: "price_label",
      label: "Price label",
      internalName: "LineToolPriceLabel",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "price_note",
    {
      shape: "price_note",
      label: "Price note",
      internalName: "LineToolPriceNote",
      family: "annotation",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "arrow_marker",
    {
      shape: "arrow_marker",
      label: "Arrow Marker",
      internalName: "LineToolArrowMarker",
      family: "marker",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "flag",
    {
      shape: "flag",
      label: "Flag mark",
      internalName: "LineToolFlagMark",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: "exact_bar_note",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "image",
    {
      shape: "image",
      label: "Image",
      internalName: "LineToolImage",
      family: "content",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "blocked_external_content_or_asset_contract",
      genericAllowed: false,
      firstClass: null,
      requiredOption: "external_asset_contract",
      runtimeOnly: true
    }
  ],
  [
    "table",
    {
      shape: "table",
      label: "Table",
      internalName: "LineToolTable",
      family: "annotation",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "vertical_line",
    {
      shape: "vertical_line",
      label: "Vertical line",
      internalName: "LineToolVertLine",
      family: "lines",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "horizontal_line",
    {
      shape: "horizontal_line",
      label: "Horizontal line",
      internalName: "LineToolHorzLine",
      family: "lines",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "cross_line",
    {
      shape: "cross_line",
      label: "Crossline",
      internalName: "LineToolCrossLine",
      family: "lines",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "horizontal_ray",
    {
      shape: "horizontal_ray",
      label: "Horizontal ray",
      internalName: "LineToolHorzRay",
      family: "lines",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "trend_line",
    {
      shape: "trend_line",
      label: "Trendline",
      internalName: "LineToolTrendLine",
      family: "lines",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "info_line",
    {
      shape: "info_line",
      label: "Info line",
      internalName: "LineToolInfoLine",
      family: "lines",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "trend_angle",
    {
      shape: "trend_angle",
      label: "Trend angle",
      internalName: "LineToolTrendAngle",
      family: "lines",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "arrow",
    {
      shape: "arrow",
      label: "Arrow",
      internalName: "LineToolArrow",
      family: "lines",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "ray",
    {
      shape: "ray",
      label: "Ray",
      internalName: "LineToolRay",
      family: "lines",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "extended",
    {
      shape: "extended",
      label: "Extended",
      internalName: "LineToolExtended",
      family: "lines",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "parallel_channel",
    {
      shape: "parallel_channel",
      label: "Parallel Channel",
      internalName: "LineToolParallelChannel",
      family: "channels",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "disjoint_angle",
    {
      shape: "disjoint_angle",
      label: "Disjoint channel",
      internalName: "LineToolDisjointAngle",
      family: "channels",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "flat_bottom",
    {
      shape: "flat_bottom",
      label: "Flat top/bottom",
      internalName: "LineToolFlatBottom",
      family: "channels",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "anchored_vwap",
    {
      shape: "anchored_vwap",
      label: "Anchored VWAP",
      internalName: "LineToolAnchoredVWAP",
      family: "volume",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: true,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "pitchfork",
    {
      shape: "pitchfork",
      label: "Pitchfork",
      internalName: "LineToolPitchfork",
      family: "pitchforks",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "schiff_pitchfork_modified",
    {
      shape: "schiff_pitchfork_modified",
      label: "Modified Schiff pitchfork",
      internalName: "LineToolSchiffPitchfork",
      family: "pitchforks",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "schiff_pitchfork",
    {
      shape: "schiff_pitchfork",
      label: "Schiff pitchfork",
      internalName: "LineToolSchiffPitchfork2",
      family: "pitchforks",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "inside_pitchfork",
    {
      shape: "inside_pitchfork",
      label: "Inside Pitchfork",
      internalName: "LineToolInsidePitchfork",
      family: "pitchforks",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "pitchfan",
    {
      shape: "pitchfan",
      label: "Pitchfan",
      internalName: "LineToolPitchfan",
      family: "pitchforks",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "gannbox",
    {
      shape: "gannbox",
      label: "Gann box",
      internalName: "LineToolGannSquare",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "gannbox_square",
    {
      shape: "gannbox_square",
      label: "Gann square",
      internalName: "LineToolGannComplex",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "gannbox_fixed",
    {
      shape: "gannbox_fixed",
      label: "Gann square fixed",
      internalName: "LineToolGannFixed",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "gannbox_fan",
    {
      shape: "gannbox_fan",
      label: "Gann fan",
      internalName: "LineToolGannFan",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_retracement",
    {
      shape: "fib_retracement",
      label: "Fib Retracement",
      internalName: "LineToolFibRetracement",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_trend_ext",
    {
      shape: "fib_trend_ext",
      label: "Trend-based fib extension",
      internalName: "LineToolTrendBasedFibExtension",
      family: "gann_fibonacci",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_speed_resist_fan",
    {
      shape: "fib_speed_resist_fan",
      label: "Fib speed resistance fan",
      internalName: "LineToolFibSpeedResistanceFan",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_timezone",
    {
      shape: "fib_timezone",
      label: "Fib time zone",
      internalName: "LineToolFibTimeZone",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_trend_time",
    {
      shape: "fib_trend_time",
      label: "Trend-based fib time",
      internalName: "LineToolTrendBasedFibTime",
      family: "gann_fibonacci",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_circles",
    {
      shape: "fib_circles",
      label: "Fib Circles",
      internalName: "LineToolFibCircles",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_spiral",
    {
      shape: "fib_spiral",
      label: "Fib Spiral",
      internalName: "LineToolFibSpiral",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_speed_resist_arcs",
    {
      shape: "fib_speed_resist_arcs",
      label: "Fib speed resistance arcs",
      internalName: "LineToolFibSpeedResistanceArcs",
      family: "gann_fibonacci",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_wedge",
    {
      shape: "fib_wedge",
      label: "Fib Wedge",
      internalName: "LineToolFibWedge",
      family: "gann_fibonacci",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fib_channel",
    {
      shape: "fib_channel",
      label: "Fib Channel",
      internalName: "LineToolFibChannel",
      family: "gann_fibonacci",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "xabcd_pattern",
    {
      shape: "xabcd_pattern",
      label: "Xabcd Pattern",
      internalName: "LineTool5PointsPattern",
      family: "patterns",
      arity: 5,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "cypher_pattern",
    {
      shape: "cypher_pattern",
      label: "Cypher Pattern",
      internalName: "LineToolCypherPattern",
      family: "patterns",
      arity: 5,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "abcd_pattern",
    {
      shape: "abcd_pattern",
      label: "Abcd Pattern",
      internalName: "LineToolABCD",
      family: "patterns",
      arity: 4,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "triangle_pattern",
    {
      shape: "triangle_pattern",
      label: "Triangle Pattern",
      internalName: "LineToolTrianglePattern",
      family: "patterns",
      arity: 4,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "3divers_pattern",
    {
      shape: "3divers_pattern",
      label: "Three drives pattern",
      internalName: "LineToolThreeDrivers",
      family: "patterns",
      arity: 7,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "head_and_shoulders",
    {
      shape: "head_and_shoulders",
      label: "Head And Shoulders",
      internalName: "LineToolHeadAndShoulders",
      family: "patterns",
      arity: 7,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "elliott_impulse_wave",
    {
      shape: "elliott_impulse_wave",
      label: "Elliott Impulse Wave",
      internalName: "LineToolElliottImpulse",
      family: "patterns",
      arity: 6,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "elliott_triangle_wave",
    {
      shape: "elliott_triangle_wave",
      label: "Elliott Triangle Wave",
      internalName: "LineToolElliottTriangle",
      family: "patterns",
      arity: 6,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "elliott_triple_combo",
    {
      shape: "elliott_triple_combo",
      label: "Elliott Triple Combo",
      internalName: "LineToolElliottTripleCombo",
      family: "patterns",
      arity: 6,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "elliott_correction",
    {
      shape: "elliott_correction",
      label: "Elliott Correction",
      internalName: "LineToolElliottCorrection",
      family: "patterns",
      arity: 4,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "elliott_double_combo",
    {
      shape: "elliott_double_combo",
      label: "Elliott Double Combo",
      internalName: "LineToolElliottDoubleCombo",
      family: "patterns",
      arity: 4,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "cyclic_lines",
    {
      shape: "cyclic_lines",
      label: "Cyclic Lines",
      internalName: "LineToolCircleLines",
      family: "patterns",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "time_cycles",
    {
      shape: "time_cycles",
      label: "Time Cycles",
      internalName: "LineToolTimeCycles",
      family: "patterns",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "sine_line",
    {
      shape: "sine_line",
      label: "Sine Line",
      internalName: "LineToolSineLine",
      family: "patterns",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "long_position",
    {
      shape: "long_position",
      label: "Long Position",
      internalName: "LineToolRiskRewardLong",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: false,
      firstClass: "position",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "short_position",
    {
      shape: "short_position",
      label: "Short Position",
      internalName: "LineToolRiskRewardShort",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: false,
      firstClass: "position",
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "forecast",
    {
      shape: "forecast",
      label: "Position forecast",
      internalName: "LineToolPrediction",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "date_range",
    {
      shape: "date_range",
      label: "Date Range",
      internalName: "LineToolDateRange",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "price_range",
    {
      shape: "price_range",
      label: "Price Range",
      internalName: "LineToolPriceRange",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "date_and_price_range",
    {
      shape: "date_and_price_range",
      label: "Date And Price Range",
      internalName: "LineToolDateAndPriceRange",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "bars_pattern",
    {
      shape: "bars_pattern",
      label: "Bars Pattern",
      internalName: "LineToolBarsPattern",
      family: "forecasting",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "ghost_feed",
    {
      shape: "ghost_feed",
      label: "Ghost Feed",
      internalName: "LineToolGhostFeed",
      family: "forecasting",
      arity: -1,
      minPoints: 2,
      route: "multipoint",
      finishRequired: true,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "projection",
    {
      shape: "projection",
      label: "Sector",
      internalName: "LineToolProjection",
      family: "forecasting",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "rectangle",
    {
      shape: "rectangle",
      label: "Rectangle",
      internalName: "LineToolRectangle",
      family: "geometry",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "rotated_rectangle",
    {
      shape: "rotated_rectangle",
      label: "Rotated Rectangle",
      internalName: "LineToolRotatedRectangle",
      family: "geometry",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "circle",
    {
      shape: "circle",
      label: "Circle",
      internalName: "LineToolCircle",
      family: "geometry",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "ellipse",
    {
      shape: "ellipse",
      label: "Ellipse",
      internalName: "LineToolEllipse",
      family: "geometry",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "triangle",
    {
      shape: "triangle",
      label: "Triangle",
      internalName: "LineToolTriangle",
      family: "geometry",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "polyline",
    {
      shape: "polyline",
      label: "Polyline",
      internalName: "LineToolPolyline",
      family: "geometry",
      arity: -1,
      minPoints: 2,
      route: "multipoint",
      finishRequired: true,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "path",
    {
      shape: "path",
      label: "Path",
      internalName: "LineToolPath",
      family: "geometry",
      arity: -1,
      minPoints: 2,
      route: "multipoint",
      finishRequired: true,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "curve",
    {
      shape: "curve",
      label: "Curve",
      internalName: "LineToolBezierQuadro",
      family: "geometry",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "double_curve",
    {
      shape: "double_curve",
      label: "Double Curve",
      internalName: "LineToolBezierCubic",
      family: "geometry",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "arc",
    {
      shape: "arc",
      label: "Arc",
      internalName: "LineToolArc",
      family: "geometry",
      arity: 3,
      route: "multipoint",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "icon",
    {
      shape: "icon",
      label: "Icon",
      internalName: "LineToolIcon",
      family: "icons",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: "icon",
      runtimeOnly: false
    }
  ],
  [
    "emoji",
    {
      shape: "emoji",
      label: "Emoji",
      internalName: "LineToolEmoji",
      family: "icons",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "blocked_external_content_or_asset_contract",
      genericAllowed: false,
      firstClass: null,
      requiredOption: "external_asset_contract",
      runtimeOnly: false
    }
  ],
  [
    "sticker",
    {
      shape: "sticker",
      label: "Sticker",
      internalName: "LineToolSticker",
      family: "icons",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "blocked_external_content_or_asset_contract",
      genericAllowed: false,
      firstClass: null,
      requiredOption: "external_asset_contract",
      runtimeOnly: false
    }
  ],
  [
    "regression_trend",
    {
      shape: "regression_trend",
      label: "Regression Trend",
      internalName: "LineToolRegressionTrend",
      family: "channels",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: true,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "fixed_range_volume_profile",
    {
      shape: "fixed_range_volume_profile",
      label: "Fixed range volume profile",
      internalName: "LineToolFixedRangeVolumeProfile",
      family: "volume",
      arity: 2,
      route: "multipoint",
      finishRequired: false,
      studyTool: true,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: false
    }
  ],
  [
    "tweet",
    {
      shape: "tweet",
      label: "Post",
      internalName: "LineToolTweet",
      family: "content",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "blocked_external_content_or_asset_contract",
      genericAllowed: false,
      firstClass: null,
      requiredOption: "external_asset_contract",
      runtimeOnly: true
    }
  ],
  [
    "idea",
    {
      shape: "idea",
      label: "Idea",
      internalName: "LineToolIdea",
      family: "content",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: false,
      status: "blocked_external_content_or_asset_contract",
      genericAllowed: false,
      firstClass: null,
      requiredOption: "external_asset_contract",
      runtimeOnly: true
    }
  ],
  [
    "anchored_volume_profile",
    {
      shape: "anchored_volume_profile",
      label: "Anchored volume profile",
      internalName: "LineToolAnchoredVolumeProfile",
      family: "volume",
      arity: 1,
      route: "single",
      finishRequired: false,
      studyTool: true,
      status: "supported",
      genericAllowed: true,
      firstClass: null,
      requiredOption: null,
      runtimeOnly: true
    }
  ]
];

export const DRAWING_REGISTRY = Object.freeze(Object.fromEntries(entries.map(([name, meta]) => [name, Object.freeze(meta)])));
export const DRAWING_SHAPES = Object.freeze(Object.keys(DRAWING_REGISTRY));
export const GENERIC_DRAWING_SHAPES = Object.freeze(DRAWING_SHAPES.filter(name => DRAWING_REGISTRY[name].genericAllowed));

export function getDrawingCapability(shape) {
  return DRAWING_REGISTRY[String(shape)] || null;
}

export function listDrawingCapabilities() {
  return DRAWING_SHAPES.map(name => ({ ...DRAWING_REGISTRY[name] }));
}
