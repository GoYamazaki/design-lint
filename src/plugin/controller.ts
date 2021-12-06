import {
  checkEffects,
  checkFills,
  checkTextType,
  createErrorObject,
  checkAllSizeIsEqual,
  checkAllRadiusIsEqual,
  checkAllStrokeIsEqual,
  // customCheckTextFills,
} from "./lintingFunctions";

import _ from "lodash";

figma.showUI(__html__, { width: 360, height: 580 });

let borderRadiusArray = [0, 2, 4, 8, 16, 24, 32];
let originalNodeTree = [];
let lintVectors = false;

figma.ui.onmessage = (msg) => {
  // Fetch a specific node by ID.
  if (msg.type === "fetch-layer-data") {
    let layer = figma.getNodeById(msg.id);
    let layerArray = [];

    // Using selection and viewport requires an array.
    layerArray.push(layer);

    // Moves the layer into focus and selects so the user can update it.
    figma.notify(`Layer ${layer.name} selected`, { timeout: 750 });
    figma.currentPage.selection = layerArray;
    figma.viewport.scrollAndZoomIntoView(layerArray);

    let layerData = JSON.stringify(layer, [
      "id",
      "name",
      "description",
      "fills",
      "key",
      "type",
      "remote",
      "paints",
      "fontName",
      "fontSize",
      "font",
    ]);

    figma.ui.postMessage({
      type: "fetched layer",
      message: layerData,
    });
  }

  // Could this be made less expensive?
  if (msg.type === "update-errors") {
    figma.ui.postMessage({
      type: "updated errors",
      errors: lint(originalNodeTree),
    });
  }

  // Updates client storage with a new ignored error
  // when the user selects "ignore" from the context menu
  if (msg.type === "update-storage") {
    let arrayToBeStored = JSON.stringify(msg.storageArray);
    figma.clientStorage.setAsync("storedErrorsToIgnore", arrayToBeStored);
  }

  // Clears all ignored errors
  // invoked from the settings menu
  if (msg.type === "update-storage-from-settings") {
    let arrayToBeStored = JSON.stringify(msg.storageArray);
    figma.clientStorage.setAsync("storedErrorsToIgnore", arrayToBeStored);

    figma.ui.postMessage({
      type: "reset storage",
      storage: arrayToBeStored,
    });

    figma.notify("Cleared ignored errors", { timeout: 1000 });
  }

  // Changes the linting rules, invoked from the settings menu
  if (msg.type === "update-lint-rules-from-settings") {
    lintVectors = msg.boolean;
  }

  // For when the user updates the border radius values to lint from the settings menu.
  if (msg.type === "update-border-radius") {
    let newString = msg.radiusValues.replace(/\s+/g, "");
    let newRadiusArray = newString.split(",");
    newRadiusArray = newRadiusArray
      .filter((x) => x.trim().length && !isNaN(x))
      .map(Number);

    // Most users won't add 0 to the array of border radius so let's add it in for them.
    if (newRadiusArray.indexOf(0) === -1) {
      newRadiusArray.unshift(0);
    }

    // Update the array we pass into checkRadius for linting.
    borderRadiusArray = newRadiusArray;

    // Save this value in client storage.
    let radiusToBeStored = JSON.stringify(borderRadiusArray);
    figma.clientStorage.setAsync("storedRadiusValues", radiusToBeStored);

    figma.ui.postMessage({
      type: "fetched border radius",
      storage: JSON.stringify(borderRadiusArray),
    });

    figma.notify("Saved new border radius values", { timeout: 1000 });
  }

  if (msg.type === "reset-border-radius") {
    borderRadiusArray = [0, 2, 4, 8, 16, 24, 32];
    figma.clientStorage.setAsync("storedRadiusValues", []);

    figma.ui.postMessage({
      type: "fetched border radius",
      storage: JSON.stringify(borderRadiusArray),
    });

    figma.notify("Reset border radius value", { timeout: 1000 });
  }

  if (msg.type === "select-multiple-layers") {
    const layerArray = msg.nodeArray;
    let nodesToBeSelected = [];

    layerArray.forEach((item) => {
      let layer = figma.getNodeById(item);
      // Using selection and viewport requires an array.
      nodesToBeSelected.push(layer);
    });

    // Moves the layer into focus and selects so the user can update it.
    figma.currentPage.selection = nodesToBeSelected;
    figma.viewport.scrollAndZoomIntoView(nodesToBeSelected);
    figma.notify("Multiple layers selected", { timeout: 1000 });
  }

  // Traverses the node tree
  function traverse(node) {
    if ("children" in node) {
      if (node.type !== "INSTANCE") {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    return node;
  }

  function traverseNodes(selection) {
    let traversedNodes = traverse(selection);

    return traversedNodes;
  }

  // Serialize nodes to pass back to the UI.
  function serializeNodes(nodes) {
    let serializedNodes = JSON.stringify(nodes, [
      "name",
      "type",
      "children",
      "id",
    ]);

    return serializedNodes;
  }

  function lint(nodes) {
    let component_nodes = [];
    let errors = {};

    nodes.forEach((element) => {
      if (element.type === "COMPONENT_SET") {
        errors = { ...lintComponentSet(element) };
        component_nodes.push(
          ...element.findChildren((e) => {
            return e.type === "COMPONENT";
          })
        );
      } else if (element.type === "COMPONENT") {
        component_nodes.push(element);
      }
    });

    errors = traverse2(component_nodes, errors);

    let errors_list = [];
    for (let k in errors) {
      errors_list.push(errors[k]);
    }
    return errors_list;
  }

  // Initialize the app
  if (msg.type === "run-app") {
    if (figma.currentPage.selection.length === 0) {
      figma.notify("Select a frame(s) to get started", { timeout: 2000 });
      return;
    } else {
      let nodes = traverseNodes(figma.currentPage.selection);

      // Maintain the original tree structure so we can enable
      // refreshing the tree and live updating errors.
      originalNodeTree = nodes;

      // Pass the array back to the UI to be displayed.
      figma.ui.postMessage({
        type: "complete",
        message: serializeNodes(nodes),
        errors: lint(nodes),
      });

      figma.notify(`Design lint is running and will auto refresh for changes`, {
        timeout: 2000,
      });

      figma.clientStorage.getAsync("storedErrorsToIgnore").then((result) => {
        figma.ui.postMessage({
          type: "fetched storage",
          storage: result,
        });
      });

      figma.clientStorage.getAsync("storedRadiusValues").then((result) => {
        if (result.length) {
          borderRadiusArray = JSON.parse(result);

          figma.ui.postMessage({
            type: "fetched border radius",
            storage: result,
          });
        }
      });
    }
  }

  function error_map(node) {
    let err_map = {};
    err_map[node.id] = { id: node.id, errors: [] };
    if (node.children) {
      err_map[node.id].children = [...node.children.map((x) => x.id)];
    } else {
      err_map[node.id].children = [];
    }

    return err_map;
  }

  function grouping(children) {
    let group = new Map();
    //Create keys in dumb way
    const groupTypeFormat = "NODETYPE:NODENAME";
    for (let child of children) {
      const groupType = groupTypeFormat
        .replace("NODETYPE", child.type)
        .replace("NODENAME", child.name);
      if (group.has(groupType)) {
        group.set(groupType, [...group.get(groupType), child]);
      } else {
        group.set(groupType, [child]);
      }
    }

    let children_in_group = [];
    group.forEach((v) => {
      children_in_group.push(v);
    });
    return children_in_group;
  }

  function traverse2(nodes, err_map) {
    if (nodes.length == 0) {
      return err_map;
    }

    for (let i = 0; i < nodes.length; i++) {
      err_map = { ...err_map, ...error_map(nodes[i]) };
    }

    let collected_error = determineType(nodes);
    collected_error.forEach((v, k) => {
      err_map[k].errors = [v];
    });

    let new_nodes = [];

    //Lint Check
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].children) {
        new_nodes.push(...nodes[i].children);
      }
    }

    let groups = grouping(new_nodes);
    groups.forEach((g) => {
      err_map = { ...err_map, ...traverse2(g, err_map) };
    });

    return err_map;
  }

  function determineType(nodes) {
    const pivot = nodes[0];
    // All of the node's type in the `nodes` array must be same.
    switch (pivot.type) {
      case "SLICE":
      case "GROUP": {
        // Groups styles apply to their children so we can skip this node type.
        let errors = [];
        return errors;
      }
      case "BOOLEAN_OPERATION":
      case "VECTOR": {
        return lintVectorRules(nodes);
      }
      case "POLYGON":
      case "STAR":
      case "ELLIPSE": {
        return lintShapeRules(nodes);
      }
      case "FRAME": {
        return lintFrameRules(nodes);
      }
      case "INSTANCE":
      case "RECTANGLE": {
        return lintRectangleRules(nodes);
      }
      case "COMPONENT": {
        return lintComponentRules(nodes);
      }
      case "TEXT": {
        return lintTextRules(nodes);
      }
      case "LINE": {
        return lintLineRules(nodes);
      }
      default: {
        // Do nothing
      }
    }
  }

  function cartesianProduct(args) {
    let r = [];
    let max = args.length - 1;
    function helper(arr, i) {
      for (var j = 0, l = args[i].length; j < l; j++) {
        var a = new Set(arr);
        a.add(args[i][j]);
        if (i == max) r.push(a);
        else helper(a, i + 1);
      }
    }
    helper([], 0);
    return r;
  }

  function eqSet(as: Set<any>, bs: Set<any>) {
    if (as.size !== bs.size) return false;
    for (let a of as) if (!bs.has(a)) return false;
    return true;
  }

  function completeComponentVariantsMap(componentNode, allVariantCombination) {
    if (componentNode.type !== "COMPONENT") {
      return;
    }

    let variants = componentNode.variantProperties;
    var combination = new Set();
    Object.keys(variants).forEach((k) => {
      combination.add(variants[k]);
    });

    return allVariantCombination.filter((e) => eqSet(e, combination) === false);
  }

  function lintComponentSet(node) {
    let errors = error_map(node);

    let allVariants = [];
    Object.keys(node.variantGroupProperties).forEach((k) => {
      allVariants.push(node.variantGroupProperties[k].values);
    });

    var allVariantCombination = cartesianProduct(allVariants);
    node.children.forEach((element) => {
      allVariantCombination = completeComponentVariantsMap(
        element,
        allVariantCombination
      );
    });

    if (allVariantCombination.length !== 0) {
      let err = createErrorObject(
        node,
        "component_set",
        "The variants combination of the children in this componentset is imcomplete.",
        `For instance, we could not find (${[...allVariantCombination[0]]
          .reduce((prev, cur) => {
            return prev + ", " + cur;
          }, "")
          .substring(1)})`
      );
      errors[node.id].errors.push(err);
    }

    return errors;
  }

  function lintComponentRules(nodes) {
    let errors = new Map();

    checkAllSizeIsEqual(nodes, errors);
    checkAllRadiusIsEqual(nodes, errors);
    checkAllStrokeIsEqual(nodes, errors);
    checkFills(nodes, errors);
    checkEffects(nodes, errors);
    return errors;
  }

  function lintLineRules(nodes) {
    let errors = new Map();

    checkAllSizeIsEqual(nodes, errors);
    checkAllStrokeIsEqual(nodes, errors);
    checkEffects(nodes, errors);

    return errors;
  }

  function lintFrameRules(nodes) {
    let errors = new Map();

    checkAllSizeIsEqual(nodes, errors);
    checkFills(nodes, errors);
    checkAllStrokeIsEqual(nodes, errors);
    checkAllRadiusIsEqual(nodes, errors);
    checkEffects(nodes, errors);

    return errors;
  }

  function lintTextRules(nodes) {
    let errors = new Map();

    checkAllSizeIsEqual(nodes, errors);
    checkTextType(nodes, errors);
    checkFills(nodes, errors);
    checkEffects(nodes, errors);
    checkAllStrokeIsEqual(nodes, errors);

    return errors;
  }

  function lintRectangleRules(nodes) {
    let errors = new Map();

    checkAllSizeIsEqual(nodes, errors);
    checkFills(nodes, errors);
    checkAllRadiusIsEqual(nodes, errors);
    checkAllStrokeIsEqual(nodes, errors);
    checkEffects(nodes, errors);

    return errors;
  }

  function lintVectorRules(nodes) {
    let errors = new Map();

    // This can be enabled by the user in settings.
    if (lintVectors === true) {
      checkAllSizeIsEqual(nodes, errors);
      checkFills(nodes, errors);
      checkAllStrokeIsEqual(nodes, errors);
      checkEffects(nodes, errors);
    }

    return errors;
  }

  function lintShapeRules(nodes) {
    let errors = new Map();

    checkAllSizeIsEqual(nodes, errors);
    checkFills(nodes, errors);
    checkAllStrokeIsEqual(nodes, errors);
    checkEffects(nodes, errors);

    return errors;
  }
};
