// Linting functions

// Generic function for creating an error object to pass to the app.
export function createErrorObject(node, type, message, value?) {
  let error = {
    message: "",
    type: "",
    node: "",
    value: "",
  };

  error.message = message;
  error.type = type;
  error.node = node;

  if (value !== undefined) {
    error.value = value;
  }

  return error;
}

////////////////////////////
// Check Nodes Use Toyota Style
////////////////////////////

export function checkFills(nodes, errors) {
  if (nodes.length === 0) {
    return;
  }

  nodes.forEach((n) => {
    if (n.fills.length && n.visible === true) {
      const fillId = n.fillStyleId;
      const fillStyle = figma.getStyleById(fillId);
      const fillStyleName = fillStyle?.name ?? "";
      if (fillStyleName.startsWith("Toyota/Day") === false) {
        const err = createErrorObject(n, "fill", "Use Toyota/Day Fill Style");
        errors.set(n.id, err);
      }
    }
  });

  return errors;
}

export function checkTextType(nodes, errors) {
  if (nodes.length === 0) {
    return;
  }

  nodes.forEach((n) => {
    const textStyleId = n.textStyleId;
    const textStyle = figma.getStyleById(textStyleId);
    const textStyleName = textStyle?.name ?? "";

    const textFontRegex = /Toyota\/.+\/10\.5\/.+/g;
    if (!textStyleName.match(textFontRegex)) {
      const err = createErrorObject(n, "text", "Use Toyota/10.5 Text Style");
      errors.set(n.id, err);
    }
  });

  return errors;
}

function checkStrokeStyle(node, errors) {
  if (node.strokes.length === 0) {
    return;
  }

  const strokeStyleId = node.strokeStyleId;
  const strokeStyle = figma.getStyleById(strokeStyleId);
  const strokeStyleName = strokeStyle?.name ?? "";
  if (strokeStyleName.startsWith("Toyota/Day") === false) {
    const err = createErrorObject(
      node,
      "stroke",
      "Use Toyota/Day Stroke Style"
    );
    errors.set(node.id, err);
  }
}

export function checkEffects(nodes, errors) {
  if (nodes.length === 0) {
    return;
  }

  nodes.forEach((n) => {
    if (n.effects.length && n.visible === true) {
      const effectId = n.effectStyleId;
      const effectStyle = figma.getStyleById(effectId);
      const effectStyleName = effectStyle?.name ?? "";
      if (effectStyleName.startsWith("Toyota/") === false) {
        const err = createErrorObject(n, "effects", "Use Toyota Effect Style");
        errors.set(n.id, err);
      }
    }
  });

  return errors;
}

////////////////////////////
// Check Node Property Consistency
////////////////////////////

export function checkAllSizeIsEqual(nodes, errors) {
  if (nodes.length === 0) {
    return;
  }
  const pivot = nodes[0].absoluteRenderBounds;

  let round = (x) => Math.round(x * 1000);

  nodes.forEach((n) => {
    const bound = n.absoluteRenderBounds;
    if (
      round(bound.height) !== round(pivot.height) ||
      round(bound.width) !== round(pivot.width)
    ) {
      const err = createErrorObject(
        n,
        "rectangle",
        "Boundary size of this node is not same as the pivot.",
        `pivot = (name: ${nodes[0].name}, w : ${
          round(pivot.width) / 1000
        }, h : ${round(pivot.height) / 1000})`
      );
      errors.set(n.id, err);
    }
  });
  return errors;
}

export function checkAllRadiusIsEqual(nodes, errors) {
  if (nodes.length === 0) {
    return;
  }
  const pivot = nodes[0];

  nodes.forEach((n) => {
    if (n.cornerRadius !== figma.mixed) {
      if (pivot.cornerRadius !== n.cornerRadius) {
        const err = createErrorObject(
          n,
          "radius",
          "Radius of this node is not same as the pivot.",
          `pivot = (name: ${nodes[0].name}, r : ${pivot.cornerRadius}`
        );
        errors.set(n.id, err);
      }
    } else {
      if (
        pivot.topLeftRadius !== n.topLeftRadius ||
        pivot.topRightRadius !== n.topRightRadius ||
        pivot.bottomLeftRadius !== n.bottomLeftRadius ||
        pivot.bottomRightRadius !== n.bottomRightRadius
      ) {
        const err = createErrorObject(
          n,
          "radius",
          "Radius of this node is not same as the pivot.",
          `pivot = (name: ${nodes[0].name}, top-left : ${pivot.topLeftRadius}, top-right : ${pivot.topRightRadius}, botttom-left : ${pivot.bottomLeftRadius}, bottom-right : ${pivot.bottomRightRadius},`
        );
        errors.set(n.id, err);
      }
    }
  });

  return errors;
}

export function checkAllStrokeIsEqual(nodes, errors) {
  if (nodes.length === 0) {
    return;
  }
  const pivot = nodes[0];

  nodes.forEach((n) => {
    checkStrokeStyle(n, errors);

    if (pivot.strokes.length !== n.strokes.length) {
      const err = createErrorObject(
        n,
        "stroke",
        "Strokes length of this node is not same as the pivot",
        `pivot = (name: ${nodes[0].name}, stroke length : ${pivot.strokes.length}`
      );
      errors.set(n.id, err);
      return;
    }

    if (pivot.strokes.length === 0) {
      return;
    }

    //Weight, Align
    if (n.strokeWeight !== pivot.strokeWeight) {
      const err = createErrorObject(
        n,
        "stroke",
        "Strokes Weight of this node is not same as the pivot",
        `pivot = (name: ${nodes[0].name}, weight : ${pivot.strokeWeight}`
      );
      errors.set(n.id, err);
    }

    if (n.strokeAlign !== pivot.strokeAlign) {
      const err = createErrorObject(
        n,
        "stroke",
        "Strokes Align of this node is not same as the pivot",
        `pivot = (name: ${nodes[0].name}, align : ${pivot.strokeAlign}`
      );
      errors.set(n.id, err);
    }
  });
  return errors;
}
