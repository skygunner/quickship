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
    this.initShipperID();
    this.preloadPackageDimensions();
    this.activateScalePolling();
};

/**
 * Kicks off background polling.
 */
namespace.Controller.prototype.activateScalePolling = function () {
    this._scale_polling = true;
    this._pollScale();
};

/**
 * Stops background polling.
 */
namespace.Controller.prototype.deactivateScalePolling = function () {
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
    that._setupSaleOrderEditButtons();
    that._setupCountryCodeChangeEvent();
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
 * Creates an object server-side representing the package currently being processed
 * (if appropriate) and then prints the label selected.
 *
 * @param list_selection
 */
namespace.Controller.prototype.createAndPrint = function (list_selection) {
    var that = this;

    if (!that.view.manualMode()) {
        that.model
            .getSaleOrderID(that.view.getSaleOrder())
            .done(function (sale_id) {
                that.model
                    .createPackage(that.view.getPackage(), sale_id, that.view.getNumPackages())
                    .done(function (res) {
                        if (!res.success) {
                            that.options.message.error("Failed to create package server-side.")
                            return;
                        }

                        that.printLabel(list_selection, res.id, function () {
                            if (res.pack_list) {
                                that.model.getPackList(res.picking_id);
                            }

                            if (res.last_package) {
                                that.model.checkInventoryAvailability(res.picking_id)
                                    .done(function () {
                                        that.model.setDelivered(sale_id)
                                            .done(function () {
                                                that.options.message.notify("Delivery order processed!", "Success");
                                            })
                                    });
                            }
                        });
                    });
            });
    } else {
        that.printLabel(list_selection);
    }
};

/**
 * Takes a number corresponding to the position of a label in the list of
 * quotes and prints the label. 1-indexed, to match the UI numbering.
 *
 * @param list_selection
 */
namespace.Controller.prototype.printLabel = function (list_selection, package_id) {
    var that = this;
    var ret = new $.Deferred();

    if (isNaN(parseInt(list_selection)) || !isFinite(list_selection)) {
        that.options.message.error("'" + list_selection + "' is not a valid number.");
        return false;
    }

    // Attempt to get the selected quote.
    try {
        var quote = that.model.getQuote(parseInt(list_selection) - 1);
    } catch (err) {
        that.options.message.error(err);
        return false;
    }

    // If we got here, we have a valid quote. Print its label!
    var label_request = null;

    // Determine how to generate the label. From a pre-created package
    // or from a manual entry?
    if (!package_id) {
        label_request = that.model.getLabelByPackage(
            that.view.getPackage(), that.view.getFromAddress(), that.view.getToAddress(), quote, that.view.getCustoms()
        );
    } else {
        label_request = that.model.getLabelByPackageID(package_id, quote);
    }

    // However we generated the label, we want to print it when we're done!
    label_request.done(function (result) {
        if (result.error) {
            that.options.message.error(result.error);
        } else if (result.errors) {
            that.options.logger.error(result);
            that.options.message.error("Could not get label! Check logger for details.")
        } else {
            if (quote.company == "USPS") {
                that.view.updateUspsBalance(result.postage_balance);
            }

            that._retried = that._retried || false;
            that.model
                .print(result.format, result.label)
                .fail(function (xhr) {
                    if (that._retried) {
                        that._retried = false;
                        return;
                    }
                    var httpsWindow, intervalID;
                    var checkWindow = function () {
                        if (httpsWindow && httpsWindow.closed) {
                            clearInterval(intervalID);
                            that.model.print(result.format, result.label)
                        }
                    };
                    intervalID = setInterval(checkWindow, 500);
                    httpsWindow = window.open(that.model._printerAPI.url);
                    that._retried = true;
                });
        }
    }).fail(function (result, message) {
        if (message) {
            that.options.message.error(message);
        } else if ("error" in result) {
            that.options.message.error(result.error);
        } else {
            that.options.message.error("Could not get label! Check logger for details.");
        }
        that.options.logger.error(result);

        return false;
    });

    // Clear the widget's state.
    that.model.reset();
    that.view.reset();

    return true;
};

/**
 * Tells the Controller's Model to load the package dimensions object into its cache.
 */
namespace.Controller.prototype.preloadPackageDimensions = function () {
    this.model.getPackageDimensions();
}

namespace.Controller.prototype.getQuotes = function (pkg, sale_id, from_address, to_address, includeLibraryMail) {
    var that = this;

    that.model
        .getQuotes(pkg, sale_id, from_address, to_address, includeLibraryMail)
        .done(function (quotes) {
            // Auto-select the cheapest quote if requested.
            if (that.view.autoprint()) {
                that.createAndPrint(1);

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
        timeout: 5, // Scale API timeout in seconds.
        poll_interval: 2 // Minimum time to wait between scale API requests in seconds.
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
    that._retried = that._retried || false;

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
        })
        .fail(function (xhr, textStatus, errorThrown) {
            if (that._retried) {
                if (that._scale_polling) {
                    setTimeout(function () {  // Rate-limit scale polling.
                        that._pollScale();
                    }, that.options.scale.poll_interval * 1000);
                }
                return;
            }
            var httpsWindow, intervalID;
            var checkWindow = function () {
                if (httpsWindow && httpsWindow.closed) {
                    clearInterval(intervalID);
                    that._pollScale();
                }
            };
            intervalID = setInterval(checkWindow, 500);
            httpsWindow = window.open(that.model._scaleAPI.url);
            that._retried = true;
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
            that.deactivateScalePolling();
        } else {
            that.activateScalePolling();
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
        that.createAndPrint(that.view.$quote_input.val());
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
        var sale_order_code = that.view.getSaleOrder();

        if (sale_order_code.toLowerCase() == "m") { // Manual shipping entry.
            that.view.showManualEntry();
            return;
        }
        that.view.hideManualEntry();

        that.model
            .getSaleOrderID(sale_order_code)
            .done(function () {
                that.view.showSaleOrderButtons();
            })
            .fail(function (err) {
                that.view.$sale_order.val('').focus();
                that.options.message.error(err.message);
            })
    })
};

/**
 * Set up event handlers for clicks on "edit sale" and "edit customer" buttons.
 *
 * @private
 */
namespace.Controller.prototype._setupSaleOrderEditButtons = function () {
    var that = this;

    that.view.$edit_sale.click(function () {
        that._openSaleForm();
    });

    that.view.$edit_customer.click(function () {
        that._openCustomerForm();
    });
};

/**
 * Opens the sale order in a popup form for editing.
 */
namespace.Controller.prototype._openSaleForm = function () {
    var that = this;

    that.model
        .getSaleOrderID(that.view.getSaleOrder()) // Function caches sale order IDs, so no efficiency worries!
        .done(function (sale_id) {
            that.model.do_action({
                'type': 'ir.actions.act_window',
                'name': 'Sale Order',
                'view_mode': 'form',
                'view_type': 'form',
                'views': [[false, 'form']],
                'res_model': 'sale.order',
                'nodestroy': true,
                'res_id': sale_id,
                'target':'new',
                'context': {'show_footer': true}
            });
        });
};

/**
 * Opens the sale order's customer in a popup form for editing.
 */
namespace.Controller.prototype._openCustomerForm = function () {
    var that = this;

    that.model
        .getCustomerID(that.view.getSaleOrder())
        .done(function (customer_id) {
            that.model.do_action({
                'type': 'ir.actions.act_window',
                'name': 'Customer',
                'view_mode': 'form',
                'view_type': 'form',
                'views': [[false, 'form']],
                'res_model': 'res.partner',
                'nodestroy': true,
                'res_id': customer_id,
                'target':'new',
                'context': {'show_footer': true}
            });
        });
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
        var emptyInputs = that.view.$step1_inputs.filter(function () {
            var $this = $(this);
            return !this.value && ($this.is(":visible") || this.type == "hidden") && !($this.hasClass('optional'));
        });

        that.view.resetQuotesUI();

        if (emptyInputs.length > 0 || parseFloat(that.view.getWeight().weight) == 0) {
            return;
        }

        var pkg = that.view.getPackage();
        var sale_order = that.view.getSaleOrder();
        var includeLibraryMail = that.view.includeLibraryMail();

        if (sale_order.toLowerCase() == "m") {
            that.getQuotes(pkg, null, that.view.getFromAddress(), that.view.getToAddress(), includeLibraryMail);
        } else {
            that.model
                .getSaleOrderID(sale_order) // Function caches sale order IDs, so no efficiency worries!
                .done(function (sale_id) {
                    that.getQuotes(pkg, sale_id, null, null, includeLibraryMail);
                })
        }
    });
};

/**
 * Set up an event to hide and show the package value field in manual entry
 * depending on whether the country codes entered are the same or not.
 */
namespace.Controller.prototype._setupCountryCodeChangeEvent = function () {
    var that = this;
    var handler = function () {
        if (that.view.getToAddress().country == "" || that.view.getFromAddress().country == "") {
            return;
        }

        if (that.view.getFromAddress().country == that.view.getToAddress().country) {
            that.view.$manual_customs.hide();
        } else {
            that.view.$manual_customs.show();
        }

    };
    that.view.$from_country.on("change", handler);
    that.view.$to_country.on("change", handler);
}