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

// Determine a nodes fills
export function determineFill(fills) {
  let fillValues = [];

  fills.forEach((fill) => {
    if (fill.type === "SOLID") {
      let rgbObj = convertColor(fill.color);
      fillValues.push(RGBToHex(rgbObj["r"], rgbObj["g"], rgbObj["b"]));
    } else if (fill.type === "IMAGE") {
      fillValues.push("Image - " + fill.imageHash);
    } else {
      const gradientValues = [];
      fill.gradientStops.forEach((gradientStops) => {
        let gradientColorObject = convertColor(gradientStops.color);
        gradientValues.push(
          RGBToHex(
            gradientColorObject["r"],
            gradientColorObject["g"],
            gradientColorObject["b"]
          )
        );
      });
      let gradientValueString = gradientValues.toString();
      fillValues.push(`${fill.type} ${gradientValueString}`);
    }
  });

  return fillValues[0];
}

// Lint border radius
export function checkRadius(node, errors, radiusValues) {
  let cornerType = node.cornerRadius;

  if (typeof cornerType !== "symbol") {
    if (cornerType === 0) {
      return;
    }
  }

  // If the radius isn't even on all sides, check each corner.
  if (typeof cornerType === "symbol") {
    if (radiusValues.indexOf(node.topLeftRadius) === -1) {
      return errors.push(
        createErrorObject(
          node,
          "radius",
          "Incorrect Top Left Radius",
          node.topRightRadius
        )
      );
    } else if (radiusValues.indexOf(node.topRightRadius) === -1) {
      return errors.push(
        createErrorObject(
          node,
          "radius",
          "Incorrect top right radius",
          node.topRightRadius
        )
      );
    } else if (radiusValues.indexOf(node.bottomLeftRadius) === -1) {
      return errors.push(
        createErrorObject(
          node,
          "radius",
          "Incorrect bottom left radius",
          node.bottomLeftRadius
        )
      );
    } else if (radiusValues.indexOf(node.bottomRightRadius) === -1) {
      return errors.push(
        createErrorObject(
          node,
          "radius",
          "Incorrect bottom right radius",
          node.bottomRightRadius
        )
      );
    } else {
      return;
    }
  } else {
    if (radiusValues.indexOf(node.cornerRadius) === -1) {
      return errors.push(
        createErrorObject(
          node,
          "radius",
          "Incorrect border radius",
          node.cornerRadius
        )
      );
    } else {
      return;
    }
  }
}

// Check for effects like shadows, blurs etc.
export function checkEffects(node, errors) {
  if (node.effects.length) {
    if (node.effectStyleId === "") {
      const effectsArray = [];

      node.effects.forEach((effect) => {
        let effectsObject = {
          type: "",
          radius: "",
          offsetX: "",
          offsetY: "",
          fill: "",
          value: "",
        };

        // All effects have a radius.
        effectsObject.radius = effect.radius;

        if (effect.type === "DROP_SHADOW") {
          effectsObject.type = "Drop Shadow";
        } else if (effect.type === "INNER_SHADOW") {
          effectsObject.type = "Inner Shadow";
        } else if (effect.type === "LAYER_BLUR") {
          effectsObject.type = "Layer Blur";
        } else {
          effectsObject.type = "Background Blur";
        }

        if (effect.color) {
          let effectsFill = convertColor(effect.color);
          effectsObject.fill = RGBToHex(
            effectsFill["r"],
            effectsFill["g"],
            effectsFill["b"]
          );
          effectsObject.offsetX = effect.offset.x;
          effectsObject.offsetY = effect.offset.y;
          effectsObject.value = `${effectsObject.type} ${effectsObject.fill} ${effectsObject.radius}px X: ${effectsObject.offsetX}, Y: ${effectsObject.offsetY}`;
        } else {
          effectsObject.value = `${effectsObject.type} ${effectsObject.radius}px`;
        }

        effectsArray.unshift(effectsObject);
      });

      let currentStyle = effectsArray[0].value;

      return errors.push(
        createErrorObject(
          node,
          "effects",
          "Missing effects style",
          currentStyle
        )
      );
    } else {
      return;
    }
  }
}

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
        const err = createErrorObject(n, "fill", "Use Toyota/Day Style");
        errors.set(n.id, err);
      }
    }
  });

  return errors;
}

export function checkStrokes(node, errors) {
  if (node.strokes.length) {
    if (node.strokeStyleId === "" && node.visible === true) {
      let strokeObject = {
        strokeWeight: "",
        strokeAlign: "",
        strokeFills: [],
      };

      strokeObject.strokeWeight = node.strokeWeight;
      strokeObject.strokeAlign = node.strokeAlign;
      strokeObject.strokeFills = determineFill(node.strokes);

      let currentStyle = `${strokeObject.strokeFills} / ${strokeObject.strokeWeight} / ${strokeObject.strokeAlign}`;

      return errors.push(
        createErrorObject(node, "stroke", "Missing stroke style", currentStyle)
      );
    } else {
      return;
    }
  }
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
      const err = createErrorObject(n, "text", "Use Toyota/10.5 Style");
      errors.set(n.id, err);
    }
  });

  return errors;
}

// Utility functions for color conversion.
const convertColor = (color) => {
  const colorObj = color;
  const figmaColor = {};

  Object.entries(colorObj).forEach((cf) => {
    const [key, value] = cf;

    if (["r", "g", "b"].includes(key)) {
      figmaColor[key] = (255 * (value as number)).toFixed(0);
    }
    if (key === "a") {
      figmaColor[key] = value;
    }
  });
  return figmaColor;
};

function RGBToHex(r, g, b) {
  r = Number(r).toString(16);
  g = Number(g).toString(16);
  b = Number(b).toString(16);

  if (r.length == 1) r = "0" + r;
  if (g.length == 1) g = "0" + g;
  if (b.length == 1) b = "0" + b;

  return "#" + r + g + b;
}
