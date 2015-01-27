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
    $("#sale_order,.participant input,input#box_code, input#num_packages, .subform input").inputPrompt();

    $("#box_dimensions input").inputPrompt({
        lock: function () {
            return $("input#box_code").inputPrompt().isLocked();
        }
    });

    // Lock the shipper input by default.
    this.$shipper.inputPrompt().toggleLock();

    // Lock number of packages by default.
    this.$num_packages.inputPrompt().toggleLock();

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
    this.hideManualEntry();
    this.hideSaleOrderButtons();
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
 * Returns the number of packages entered.
 *
 * @returns {String}
 */
namespace.View.prototype.getNumPackages = function () {
    return this.$num_packages.val();
};

/**
 * Returns the package value entered.
 *
 * @returns {String}
 */
namespace.View.prototype.getPackageValue = function () {
    return this.$package_value.val();
};

/**
 * Returns a JSON object representing a package suitable for passing to the server.
 *
 * @returns {{...}}
 */
namespace.View.prototype.getPackage = function () {
    var dimensions = this.getDimensions();
    var pkg = {
        'scale': this.getWeight(),
        'length': dimensions.length,
        'width': dimensions.width,
        'height': dimensions.height,
        'picker_id': this.getPicker(),
        'packer_id': this.getPacker(),
        'shipper_id': this.getShipper()
    };

    if (this.$manual_customs.is(":visible")) {
        pkg['value'] = this.getPackageValue();
    }

    return pkg;
}

/**
 * Grabs all the customs-related fields and returns a JSON object suitable for passing to the server.
 *
 * @returns {{*}}
 */
namespace.View.prototype.getCustoms = function () {
    if (!this.$manual_customs.is(":visible")) {
        return null;
    }

    return {
        "contents_type": this.manual_customs.$contents_type.val(),
        "signature": this.manual_customs.$signature.val(),
        "items": [
            {
               "description": this.manual_customs.$description.val(),
               "value": this.manual_customs.$value.val(),
               "commodity_code": this.manual_customs.$commodity_code.val()
            }
        ]
    };
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
namespace.View.prototype.getDimensions = function () {
    return {
        length: parseFloat(this.box.$length.val()),
        width: parseFloat(this.box.$width.val()),
        height: parseFloat(this.box.$height.val())
    };
};

/**
 * Get a JSON object representing the manually entered "from" address.
 *
 * @returns {{}}
 */
namespace.View.prototype.getFromAddress = function () {
    var address = {};
    this.$from_address.find("input:visible").each(function (i, elem) { address[this.name] = this.value });
    return address;
}

/**
 * Get a JSON object representing the manually entered "to" address.
 * @returns {{}}
 */
namespace.View.prototype.getToAddress = function () {
    var address = {};
    this.$to_address.find("input:visible").each(function (i, elem) { address[this.name] = this.value });
    return address;
}

/**
 * Get an element by its field name.
 *
 * @param field_name
 * @returns {*|jQuery|HTMLElement}
 */
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
    var serviceName;

    for (var i=0; i < quotes.length; i++) {
        serviceName = quotes[i].service;

        if (serviceName.toLowerCase().indexOf(quotes[i].company.toLowerCase()) !== 0) {
            serviceName = quotes[i].company + " " + serviceName;
        }

        this.$quotes.append("<li>" + serviceName + " - $" + quotes[i].price.toFixed(2) + "</li>");
    }

   this.$step2.show();
   this.$quote_input.val("").focus();
};

/**
 * Show address entry for manual shipping actions.
 */
namespace.View.prototype.showManualEntry = function () {
    this.$num_packages.parent().hide();
    this.$num_packages.val('');
    this.$manual_entry.show().find("input").val('');
};

/**
 * Hide address entry for manual shipping actions.
 */
namespace.View.prototype.hideManualEntry = function () {
    this.$num_packages.parent().show();
    this.$manual_entry.hide();
};


/**
 * Show sale order editing buttons.
 */
namespace.View.prototype.showSaleOrderButtons = function () {
    this.$edit_sale.parent().addClass("visible");
};

/**
 * Hide sale order editing buttons.
 */
namespace.View.prototype.hideSaleOrderButtons = function () {
    this.$edit_sale.parent().removeClass("visible");
};

/**
 * Return `true` if we are currently in "manual mode."
 *
 * @returns {*}
 */
namespace.View.prototype.manualMode = function () {
    return this.$manual_entry.is(":visible");
}

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
    this.$edit_sale = $("#edit_sale_button");
    this.$edit_customer = $("#edit_sale_customer");
    this.$num_packages = $("#num_packages");
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
    this.$manual_entry = $("#manual_entry");
    this.$from_address = $("#from_address,#from_phone");
    this.$to_address = $("#to_address");
    this.$from_country = $("#from_country");
    this.$to_country = $("#to_country");
    this.$package_value = $("#package_value");
    this.$manual_customs = $("#manual_customs");
    this.manual_customs = {
        $signature: $("#customs_signature"),
        $contents_type: $("#customs_contents_type"),
        $description: $("#customs_description"),
        $value: this.$package_value,
        $commodity_code: $("#customs_commodity_code")
    };
};