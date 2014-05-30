var namespace = new Namespace('ryepdx.openerp.quickship.kiosk');

/**
 * Keeps references to various elements in the page, making it easier for us
 * to change those elements if we ever find the need to. Also sets up plugins.
 *
 * @constructor
 */
namespace.View = function () {
    // Set up references to the various parts of the screen we'll be using.
    this._setupProperties();

    // Set up InputPrompt objects.
    $("#sale_order,.participant input,input#box_code").inputPrompt();

    // Lock the box dimensions inputs if the box code is locked as well.
    $("#box_dimensions input").inputPrompt({
        lock: this.box.$code.inputPrompt()
    });

    // Lock the shipper input by default.
    this.$shipper.inputPrompt().toggleLock();

    // Set initial UI state.
    this.reset();
};

/**
 * Clear the input elements in the UI.
 */
namespace.View.prototype.clear = function ($inputs) {
    $inputs = $inputs || this.$inputs;

    $inputs.each(function () {
        var inputPrompt = $(this).data("inputPrompt");
        if ((!inputPrompt || !inputPrompt.isLocked()) && this.type !== "checkbox") {
            this.value = '';
        }
    });
};

/**
 * Reset the UI.
 */
namespace.View.prototype.reset = function () {
    this.resetPackageUI();
    this.resetQuotesUI();
};

/**
 * Reset the part of the UI related to creating/adding packages to sales orders.
 */
namespace.View.prototype.resetPackageUI = function () {
    this.clear();
    this.$picker.focus();
};

/**
 * Reset the part of the UI related to picking quotes.
 */
namespace.View.prototype.resetQuotesUI = function () {
    this.$quotes.empty();
    this.$step2.hide();
};

/**
 * Updates the UI based on the passed-in scale reading.
 * Takes an object with a weight and a unit property.
 * Can also take an object with jQuery elements, for testing purposes.
 *
 * @param reading
 * @param scale (optional)
 */
namespace.View.prototype.updateWeight = function (reading, scale) {
    scale = scale || this.scale;

    var oldWeight = this.getWeight();

    scale.$display.text(reading.weight + " " + reading.unit + "s");
    scale.$weight.val(reading.weight).trigger("change");
    scale.$unit.val(reading.unit).trigger("change");
};

/**
 * Updates the USPS balance displayed.
 *
 * @param balance
 * @param $balance_display
 */
namespace.View.prototype.updateUspsBalance = function (balance, $balance_display) {
    $balance_display = $balance_display || this.$usps_balance;

    balance = parseFloat(balance, 10).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, "$1,").toString();
    $balance_display.text("$" + balance);
};

/**
 * Gets the current weight displayed.
 *
 * @returns {{value: *, unit: *}}
 */
namespace.View.prototype.getWeight = function () {
    return {
        weight: this.scale.$weight.val(),
        unit: this.scale.$unit.val()
    }
};

/**
 * Gets the current picker ID.
 *
 * @returns {*}
 */
namespace.View.prototype.getPicker = function () {
    return this.$picker.val();
};

/**
 * Gets the current packer ID.
 *
 * @returns {*}
 */
namespace.View.prototype.getPacker = function () {
    return this.$packer.val();
};

/**
 * Gets the current shipper ID.
 *
 * @returns {*}
 */
namespace.View.prototype.getShipper = function () {
    return this.$shipper.val();
};

/**
 * Sets the current shipper ID>
 *
 * @param shipper_id
 */
namespace.View.prototype.setShipper = function (shipper_id) {
    this.$shipper.val(shipper_id);
};

/**
 * Gets the current sale order ID.
 *
 * @returns {*}
 */
namespace.View.prototype.getSaleOrder = function () {
    return this.$sale_order.val();
};

/**
 * Gets the current box code.
 *
 * @returns {*}
 */
namespace.View.prototype.getPackageCode = function () {
    return this.box.$code.val();
};

/**
 * Sets the current box dimensions.
 *
 * @param dimensions
 */
namespace.View.prototype.setBoxDimensions = function (dimensions) {
    this.box.$length.val(dimensions.length).trigger("change");
    this.box.$width.val(dimensions.width).trigger("change");
    this.box.$height.val(dimensions.height).trigger("change");
}

/**
 * Returns the box dimensions currently filled in.
 *
 * @returns {{length: *, width: *, height: *}}
 */
namespace.View.prototype.getBoxDimensions = function () {
    return {
        length: this.box.$length.val(),
        width: this.box.$width.val(),
        height: this.box.$height.val()
    };
};

namespace.View.prototype.elementByField = function (field_name) {
    switch (field_name) {

        case "picker_id":
            return this.$picker;

        case "packer_id":
            return this.$packer;

        case "shipper_id":
            return this.$shipper;
    }
};

/**
 * Returns `true` if the shipping quotes should include library mail.
 *
 * @returns {boolean}
 */
namespace.View.prototype.includeLibraryMail = function () {
    return !(this.$no_library_mail.is(":checked"));
}

/**
 * Attempts to select the quote whose number was passed in.
 * Returns `true` if successful, and `false` otherwise.
 *
 * @param index
 * @returns {boolean}
 */
namespace.View.prototype.selectQuote = function (index) {
    var quotes = this.$quotes.children();
    $(quotes).removeClass("selected");

    index = parseInt(index);

    if (!isNaN(index) && index > 0 && index <= quotes.length) {
        $(quotes[index-1]).addClass("selected");
        return true;
    }
    return false;
};

/**
 * Display passed-in quotes as a list.
 *
 * @param quotes
 */
namespace.View.prototype.showQuotes = function (quotes) {
    this.$quotes.empty();

    for (var i=0; i < quotes.length; i++) {
        this.$quotes.append("<li>" + quotes[i].service + " - $" + quotes[i].price.toFixed(2) + "</li>");
    }

   this.$step2.show();
   this.$quote_input.val("").focus();
};

/**
 * Returns true if quotes list is visible.
 *
 * @returns {*}
 */
namespace.View.prototype.showingQuotes = function () {
    return this.$quotes.is(":visible");
}

/**
 * Returns `true` if the user wants to automatically print the cheapest label.
 *
 * @returns {boolean}
 */
namespace.View.prototype.autoprint = function () {
    return this.$autoprint.is(":checked");
}

/**
 * Sets the jQuery element and jQuery selector properties.
 *
 * @private
 */
namespace.View.prototype._setupProperties = function () {
    this.$sale_order = $("#sale_order");
    this.$picker = $("#picker_id");
    this.$packer = $("#packer_id");
    this.$shipper = $("#shipper_id");
    this.scale = {
        $weight: $("#weight_value"),
        $unit: $("#weight_unit"),
        $display: $("#weight")
    };
    this.box = {
        $code: $("#box_code"),
        $length: $("#box_length"),
        $width: $("#box_width"),
        $height: $("#box_height")
    };
    this.$step2 = $("#step-2");
    this.$quotes = $("#quotes_list");
    this.$quote_input = $("#quote_selected");
    this.$quote_okay = $("#quote_okay");
    this.$quote_cancel = $("#quote_cancel");
    this.$usps_balance = $('#uspsBalance');
    this.$inputs = $("#quickship_kiosk input");
    this.$step1_inputs = $("#quickship_kiosk #step-1 input:not(#box_code)");
    this.$no_library_mail = $("#no_library_mail");
    this.$autoprint = $("#autoprint");
};