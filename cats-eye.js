"use strict";

// Draw a triangle clipping of the image.
//
// Note that we have to overcompensate on the edges of the hypotenuse,
// otherwise the rendering in some browsers can leave a layout pixel blank
// between the eventual rotations.
function drawTriangle(image, context, size) {
  context.save();
  context.beginPath();
  context.moveTo(-0.5, 0);
  context.lineTo(size, 0);
  context.lineTo(size, size + 0.5);
  context.lineTo(-0.5, 0);
  context.clip();
  context.drawImage(image, 0, 0, size, size);
  context.restore();
}

// Draw multiple triangles of the given image to make the full pattern.
function drawTriangles(image, context, size) {
  var i, j;

  // Draw a triangle and its reflection at each of four rotations around the
  // origin.
  for (i = 0; i < 4; i += 1) {
    for (j = 0; j < 2; j += 1) {
      context.scale(1, -1);
      drawTriangle(image, context, size);
    }

    context.rotate(Math.PI / 2);
  }
}

function makePattern(image) {
  var canvas, context, size;

  // Grab the image and the canvas, and get the size of the image's smallest
  // dimension.
  canvas = document.createElement("canvas");
  size = Math.min(image.width, image.height);

  // Make the canvas a square with edges of length the size.
  canvas.width = canvas.height = size * 2;

  // Grab the context, and move the origin into the middle of the canvas.
  context = canvas.getContext("2d");
  context.translate(size, size);

  drawTriangles(image, context, size);

  return canvas;
}

// Fill the screen with the larger canvas, and draw the smaller canvas as a
// repeating pattern on the larger canvas.
function drawPattern(canvas, layout) {
  var context, height, pattern, size, width;

  // Fetch the size of the layout canvas, which is assumed to be a square. The
  // size of the image is half of the size of the canvas.
  size = layout.width / 2;

  // Now grab the context of the preview canvas, and turn the given layout
  // into a repeating pattern in the context.
  context = canvas.getContext("2d");
  pattern = context.createPattern(layout, "repeat");

  // Fetch the width and height of the canvas.
  width = canvas.width;
  height = canvas.height;

  // Move the origin to the center of the canvas, and then draw a rectangle
  // from back at the top left corner to the size of the large canvas. Fill
  // the rectangle with the contexting pattern of the smaller canvas.
  context.translate(width / 2, height / 2);
  context.rect(-width / 2, -height / 2, width, height);
  context.fillStyle = pattern;
  context.fill();
}

// Draw the pattern onto the given canvas, resizing it to fill its container.
function drawPreview(pattern, canvas) {
  // Fetch the container of the canvas.
  var container = canvas.parentNode;

  // Set the size of the canvas to 0, to allow the container to return to its
  // natural size.
  canvas.width = 0;
  canvas.height = 0;

  // Set the size of the preview canvas to the size of the container.
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;

  // Draw the pattern on the preview canvas.
  drawPattern(canvas, pattern);
}

// Draw the pattern on a new canvas of the given width and height for output,
// and return the resulting canvas.
function drawOutput(pattern, width, height) {
  // Construct the canvas with the given width and height;
  var canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  // Draw the pattern on the new canvas.
  drawPattern(canvas, pattern);

  return canvas;
}

// Prompt the user to select an image, calling the given function if the user
// makes a choice.
function selectImage(callback) {
  // Construct a new file selector for images.
  var selector = document.createElement("input");
  selector.type = "file";
  selector.accept = "image/*";

  // Run the callback once a change occurs.
  selector.onchange = function () {
    var image = this.files[0];

    // Check if a file was provided. Might be worth checking the type of the
    // file is an image in the future.
    if (image) {
      callback(image);
    }
  };

  // Simulate a click on the input, triggering the prompt.
  selector.dispatchEvent(new MouseEvent("click"));
}

// Read the given image file as a data URL, calling the given function if this
// is successful.
function readImageAsURL(file, callback) {
  var reader = new FileReader();

  // Run the callback once the file is successfully loaded. There should
  // probably be an error handler here as well.
  reader.onload = function () {
    callback(this.result);
  };

  // Read the file as a URL.
  reader.readAsDataURL(file);
}

// Load the image at the given URL, passing the resulting image to the
// callback once the load completes.
function loadImageAsElement(url, callback) {
  var image = document.createElement("img");

  // Just run the callback with the image once the load completes.
  image.onload = function () {
    callback(this);
  };

  // Trigger the load.
  image.src = url;
}

// Trigger a save of the given canvas as an image download with the given name
// and media type.
function saveCanvas(name, type, canvas) {
  // Construct a link to simulate a click on.
  var link = document.createElement("a");

  // Calculate the name and type of the output file from the input, and
  // trigger the save.
  link.download = "catseye-" + name;
  link.href = canvas.toDataURL(type);
  link.dispatchEvent(new MouseEvent("click"));
}

// Render and download the currently loaded pattern.
function saveImage(name, type, pattern, rendering) {
  var canvas, height, width;

  // Fetch the requested width and height of the output image.
  width = rendering.width.value;
  height = rendering.height.value;

  // Draw and save the output.
  canvas = drawOutput(pattern, width, height);
  saveCanvas(name, type, canvas);
}

// Load and preview the image at the given URL, and set up the save button to
// download the rendered image with all of the given information.
function previewImage(name, type, url, rendering) {
  // Load the URL into an image.
  loadImageAsElement(url, function (image) {
    // Make a pattern of the image.
    var pattern = makePattern(image);

    // Preview the resulting pattern.
    drawPreview(pattern, rendering.canvas);

    // When the window is resized, resize the canvas to fill the new screen
    // size.
    window.onresize = function () {
      drawPreview(pattern, rendering.canvas);
    };

    // Enable the save button, and trigger a save when it is clicked.
    rendering.saveButton.disabled = false;
    rendering.saveButton.onclick = function () {
      saveImage(name, type, pattern, rendering);
    };
  });
}

// Try and save the given data about an image in the persistent store as the
// most recent image to be loaded. Does nothing if localStorage is not
// supported.
function storeLastImage(name, type, url) {
  // Check if localStorage is available.
  if (typeof localStorage === "object") {
    // Save the information as a JSON string.
    localStorage.image = JSON.stringify({
      "name": name,
      "type": type,
      "url": url
    });
  }
}

// Try to fetch data about the most recent image. Returns null if no image has
// been saved of if localStorage is not supported.
function fetchLastImage() {
  // Check if localStorage is available, and if an image has been saved.
  if (typeof localStorage === "object" && localStorage.image) {
    try {
      // Attempt to parse the saved image.
      return JSON.parse(localStorage.image);
    } catch (error) {
      // If the parsing failed, the information can't be used and should just
      // be deleted.
      delete localStorage.image;
      return null;
    }
  }

  return null;
}

// Try and load the last image as a pattern, if such an image exists, using the
// given rendering context.
function reloadLastImage(rendering) {
  var image = fetchLastImage();

  if (image !== null) {
    previewImage(image.name, image.type, image.url, rendering);
  }
}

// Read, store, and preview an image file as a pattern using the given rendering
// context.
function loadAndPreviewImage(file, rendering) {
  // Read the selected file as a URL.
  readImageAsURL(file, function (url) {
    // Store the selected and read file's information.
    storeLastImage(file.name, file.type, url);

    // Preview the image.
    previewImage(file.name, file.type, url, rendering);
  });
}

// Try and save the given dimension value in the persistent store for the given
// name. Does nothing if localStorage is not supported.
function storeDimension(name, value) {
  // Check if localStorage is available.
  if (typeof localStorage === "object") {
    localStorage[name] = value;
  }
}

// Try to fetch the stored value for the given dimension. Returns NaN if no
// value has been saved of if localStorage is not supported.
function fetchDimension(name) {
  // Check if localStorage is available, and if a dimension has been stored.
  if (typeof localStorage === "object" && localStorage[name]) {
    // Attempt to parse the dimension value. If this fails, it returns NaN.
    return parseInt(localStorage[name], 10);
  }

  return NaN;
}

// Set up the button events once the page is loaded.
window.onload = function () {
  // Set up the rendering context with the appropriate elements.
  var rendering = {
    "canvas": document.getElementById("preview-canvas"),
    "saveButton": document.getElementById("save-image"),
    "width": document.getElementById("save-width"),
    "height": document.getElementById("save-height")
  };

  // Select and load an image when the load image button is clicked.
  document.getElementById("load-image").onclick = function () {
    selectImage(function (file) {
      loadAndPreviewImage(file, rendering);
    });
  };

  // Set up both dimension inputs.
  ["width", "height"].forEach(function (name) {
    var element, value;

    // Fetch the dimension input. It's already stored in the rendering context,
    // so just grab it from there.
    element = rendering[name];

    // Store the values of the dimensions when they change.
    element.onchange = function () {
      if (this.value < this.min) {
        // If the value is too small, set it back to the minimum.
        this.value = this.min;
      } else {
        // Force the value to be an integer.
        this.value = Math.floor(this.value);
      }

      // Store the value in persistent storage.
      storeDimension(name, this.value);
    };

    // Set the initial values of the dimensions.
    value = fetchDimension(name);
    if (!isNaN(value)) {
      element.value = value;
    }
  });

  // Load the last used image from the store if possible.
  reloadLastImage(rendering);
};
