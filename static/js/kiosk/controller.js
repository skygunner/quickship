var namespace = new Namespace("ryepdx.openerp.quickship.kiosk");

/**
 * Coordinates the UI and the server.
 * The model and view should both be primarily inert classes that the controller does things to.
 * The controller sets up UI events and tells the model to do things to the server based on those events.
 * The controller also tells the UI to update itself based on the model's responses.
 *
 * @param model
 * @param view
 * @constructor
 */
namespace.Controller = function (model, view, options) {
    this.view = view;
    this.model = model;
    this.options = this._parseOptions(options);

    this._scale_polling = false;

    this.setupEvents();
    this.initUspsBalance();
    this.activate();
};

/**
 * Kicks off background polling.
 */
namespace.Controller.prototype.activate = function () {
    this._scale_polling = true;
    this._pollScale();
};

/**
 * Stops background polling.
 */
namespace.Controller.prototype.deactivate = function () {
    this._scale_polling = false;
};

/**
 * Wires up View events to Model actions.
 */
namespace.Controller.prototype.setupEvents = function () {
    var that = this;
    that._setupHashChangeEvent();
    that._setupSelectedQuoteChangeEvent();
    that._setupSelectedQuoteOkayButton();
    that._setupSelectedQuoteCancelButton();
    that._setupInputCompleteEvent();
    that._setupBoxCodeSelectedEvent();
    that._setupSaleOrderChangeEvent();
};

/**
 * Set the initial USPS account balance in the View.
 */
namespace.Controller.prototype.initUspsBalance = function () {
    var that = this;

    that.model
        .getUspsAccount()
        .done(function (response) {
            if (response.postage_balance) {
                that.view.updateUspsBalance(response.postage_balance);
            }
            if (response.error) {
                that.options.logger.error("Error retrieving USPS balance: \"" + response.error + "\"");
                that.options.message.error("Could not retrieve USPS balance!");
            }
        });
};

/**
 * Set the shipper ID default value.
 */
namespace.Controller.prototype.initShipperID = function () {
    var that = this;

    that.model
        .getQuickshipID()
        .done(function (quickship_id) {
            that.view.setShipper(quickship_id);
        });
}

/**
 * Takes a number corresponding to the position of a label in the list of
 * quotes and prints the label. 1-indexed, to match the UI numbering.
 *
 * @param list_selection
 */
namespace.Controller.prototype.printLabel = function (list_selection) {
    var that = this;
    if (isNaN(parseInt(list_selection)) || !isFinite(list_selection)) {
        that.options.message.error("'" + list_selection + "' is not a valid number.");
        return;
    }

    // Attempt to get the selected quote.
    try {
        var quote = that.model.getQuote(parseInt(list_selection) - 1);
    } catch (err) {
        that.options.message.error(err);
        return;
    }

    // If we got here, we have a valid quote. Print its label!
    that.model
        .getLabel(that.model.getPackageID(), quote)
        .done(function (result) {
            if (result.errors) {
                that.options.logger.error(result);
                that.options.message.error("Could not get label! Check logger for details.")
            } else {
                if (quote.company == "USPS") {
                    that.view.updateUspsBalance(result.postage_balance);
                }
                that.model.print("EPL2", result.label);
            }
        });

    // Clear the widget's state.
    that.model.reset();
    that.view.reset();
};

/**
 * Takes an options object, fills in its omitted fields with defaults, and returns it.
 *
 * @param userOptions
 * @returns {*|{}}
 * @private
 */
namespace.Controller.prototype._parseOptions = function (user_options) {
    var options = user_options || {};

    options.scale = $.extend({
        timeout: 2, // Scale API timeout in seconds.
        poll_interval: 1 // Minimum time to wait between scale API requests in seconds.
    }, options.scale);

    options.logger = $.extend({
        error: function (message) {
            console.error(message);
        },
        log: function (message) {
            console.log(message);
        }
    }, options.logger);

    options.message = $.extend({
        error: function (message) {
            alert(message);
        },
        alert: function (message) {
            alert(message);
        }
    }, options.message);

    return options;
};

/**
 * Internal function for repeated polling of the scale proxy.
 *
 * @private
 */
namespace.Controller.prototype._pollScale = function () {
    var that = this;
    that.model
        .weigh(that.scale_timeout)
        .done(function (reading) {
            if (that._scale_polling) {
                setTimeout(function () {  // Rate-limit scale polling.
                    that._pollScale();
                }, that.options.scale.poll_interval * 1000);
            }

            // We only want to change the hidden input values
            // if the values have changed. Otherwise we end up
            // polling the server for quotes with every _pollScale.
            var inputs = that.view.getWeight();
            if (parseFloat(inputs.weight) !== parseFloat(reading.weight) || inputs.unit !== reading.unit) {
                that.view.updateWeight(reading);
            }
        });
};

/**
 * Set up event that activates and deactivates background polling
 * upon navigating to and from the Kiosk widget, respectively.
 *
 * @private
 */
namespace.Controller.prototype._setupHashChangeEvent = function () {
    var that = this;
    that._kioskHash = window.location.hash;

    $(window).on("hashchange", function () {
        if (that._kioskHash == "") {
            return;
        }

        if (window.location.hash != that._kioskHash) {
            that.deactivate();
        } else {
            that.activate();
        }
    });
};

/**
 * Set up an event that triggers label generation and printing
 * once a label quote has been selected, and updates the selected
 * quote in the meantime.
 *
 * @private
 */
namespace.Controller.prototype._setupSelectedQuoteChangeEvent = function () {
    var that = this;

    // Watch and wait for a quote to be selected.
    that.view.$quote_input.on("keyup", function (e) {
        if (that.view.selectQuote(this.value) && e.keyCode == 13) { // Enter
            that.view.$quote_okay.click();
        }

        if (e.keyCode == 27) { // Esc
            that.view.$quote_cancel.click();
        }
    });
};

/**
 * Set up an event that triggers label generation and printing once a label
 * quote has been selected and the "Okay" button pressed.
 * @private
 */
namespace.Controller.prototype._setupSelectedQuoteOkayButton = function () {
    var that = this;

    that.view.$quote_okay.on("click", function () {
        that.printLabel(that.view.$quote_input.val());
    });
};

/**
 * Set up an event that clears out the quotes generated upon clicking the
 * "Cancel" button.
 * @private
 */
namespace.Controller.prototype._setupSelectedQuoteCancelButton = function () {
    var that = this;

    that.view.$quote_cancel.on("click", function () {
        that.view.reset();
    });
};

/**
 * Set up an event to update the View's box dimensions when a box code is entered.
 *
 * @private
 */
namespace.Controller.prototype._setupBoxCodeSelectedEvent = function () {
    var that = this;
    that.view.box.$code.on("change", function () {
        that.model
            .getPackageDimensions(that.view.getPackageCode())
            .done(function (dimensions) {
                if (dimensions) {
                    that.view.setBoxDimensions(dimensions);
                } else {
                    that.view.setBoxDimensions({
                        length: '',
                        width: '',
                        height: ''
                    });
                }
            });
    });
};

/**
 * Set up an event to check sale order codes as they get entered.
 *
 * @private
 */
namespace.Controller.prototype._setupSaleOrderChangeEvent = function () {
    var that = this;

    that.view.$sale_order.on("change", function () {
        that.model
            .getSaleOrderID(that.view.getSaleOrder())
            .fail(function () {
                that.view.$sale_order.val('').focus();
                that.options.message.error("Invalid sale order!")
            })
    })
};

/**
 * Set up an event that triggers shipping quote generation and autoprinting
 * once all the inputs in step 1 have been filled in.
 *
 * @private
 */
namespace.Controller.prototype._setupInputCompleteEvent = function () {
    var that = this;

    that.view.$step1_inputs.on("change", function (e) {
        var emptyInputs = that.view.$step1_inputs.filter(function () { return !this.value; });

        if (!that.view.showingQuotes() && emptyInputs.length == 0) {
            var includeLibraryMail = that.view.includeLibraryMail();
            var pkg = {
                'scale': that.view.getWeight(),
                'picker_id': that.view.getPicker(),
                'packer_id': that.view.getPacker(),
                'shipper_id': that.view.getShipper()
            };

            that.model
                .getQuotes(that.view.getSaleOrder(), pkg, includeLibraryMail)
                .done(function (quotes) {
                    // Auto-select the cheapest quote if requested.
                    if (that.view.autoprint()) {
                        that.printLabel(1);

                   // Otherwise display the quotes for the user to select.
                   } else {
                       that.view.showQuotes(quotes);
                   }
                })
                .fail(function (response) {
                    that.options.logger.error(response);
                    that.options.message.error(response.error);

                    if (response.field) {
                        that.view.elementByField(response.field).val('').focus();
                    }
                });
        }
    });
};