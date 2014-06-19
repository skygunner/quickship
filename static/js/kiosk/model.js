var namespace = new Namespace('ryepdx.openerp.quickship.kiosk');
var decorators = ryepdx.async.decorators;

/**
 * Handles communicating with the servers and providing data for the Controller class.
 *
 * @param api
 * @constructor
 */
namespace.Model = function Model (api, printerAPI, scaleAPI, actionAPI) {
    this._api = api;
    this._printerAPI = printerAPI;
    this._scaleAPI = scaleAPI;
    this._actionAPI = actionAPI;
    this._cache = {};
    this.reset();
};

/**
 * Clear out stateful data.
 */
namespace.Model.prototype.reset = function () {
    this._quotes = [];
};

/**
 * Gets a reading from the scale proxy server.
 * If no callback is passed in, it runs synchronously and returns the server's response as an object.
 * If a callback is passed in, it runs asynchronously and passes the server's response to the callback,
 * returning nothing.
 *
 * The callback should expect to take the server's response object as its first argument and an error
 * message as an optional second argument.
 *
 * @param timeout
 * @param callback (optional)
 * @returns undefined || {{ weight: *, unit: * }}
 */
namespace.Model.prototype.weigh = decorators.deferrable(function (ret, timeout) {
    // Scale input capturing.
    // "inf" = wait until the scale returns something, no timeouts.
    this._scaleAPI.weigh(timeout)
        .done(function (result) {
            if (!result || !result.weight || !result.unit) {
                ret.reject(result, "Unable to get scale reading!");
            } else {
                ret.resolve(result);
            }
        })
        .fail(function (result) {
            ret.reject(result);
        });
});

/**
 * Returns the user's Endicia/USPS account status.
 *
 * @param callback (optional)
 * @return {{*}}
 */
namespace.Model.prototype.getUspsAccount = decorators.deferrable(function (ret, test) {
    this._api.get_usps_account(test).done(function (response) {ret.resolve(response)});
});

/**
 * Returns the dimensions for a given package if a code is specified.
 * Returns a mapping of codes to dimensions if a code is not specified.
 *
 * @param code (optional)
 * @param bypassCache (optional)
 * @param callback (optional)
 * @return {{*}}
 */
namespace.Model.prototype.getPackageDimensions = decorators.deferrable(function (ret, code, bypassCache) {
    var that = this;

    if (bypassCache || typeof(that._cache.getPackageDimensions) == "undefined") {
        that._api.get_package_types().done(function (response) {
            var dimensions = {};

            for (var i=0; i < response.length; i++) {
                dimensions[response[i].code] = {
                    length: response[i].length,
                    width: response[i].width,
                    height: response[i].height
                };
            }
            that._cache.getPackageDimensions = dimensions;

            if (code) {
                ret.resolve(dimensions[code]);
            } else {
                ret.resolve(dimensions);
            }
        });
    } else {
        if (code) {
            ret.resolve(that._cache.getPackageDimensions[code]);
        } else {
            ret.resolve(that._cache.getPackageDimensions);
        }
    }
});

/**
 * Takes a sale order code and returns its OpenERP ID.
 *
 * @param sale_order_code
 * @return sale_order_id
 */
namespace.Model.prototype.getSaleOrderID = decorators.deferrable(function (ret, sale_order_code, bypassCache) {
    var that = this;

    if (typeof(that._cache.getSaleOrderID) == "undefined") {
        that._cache.getSaleOrderID = {};
    }

    if (bypassCache || typeof(that._cache.getSaleOrderID[sale_order_code] == "undefined")) {
        this._api.get_sale_order(sale_order_code).done(function (sale_orders) {
            if (sale_orders && sale_orders.length > 0) {
                that._cache.getSaleOrderID[sale_order_code] = sale_orders[0].id;
                ret.resolve(sale_orders[0].id);
            } else {
                ret.reject(sale_orders);
            }
        });
    } else {
        ret.resolve(that._cache.getSaleOrderID[sale_order_code]);
    }
});

/**
 * Create a package for the given sale order and get a list of shipping quotes for it.
 *
 * @param sale_order
 * @param package
 * @param include_library_mail
 * @param callback (optional)
 */
namespace.Model.prototype.getQuotes = decorators.deferrable(
    function (ret, pkg, sale_id, from_address, to_address, include_library_mail) {
        var that = this;

        that._api
        .get_quotes(pkg, sale_id, from_address, to_address)
        .done(function (result) {
           that._quotes = [];

           // Did we succeed or fail?
           if (result.error) {
               ret.reject(result);
               return;
           }

           // Sort quotes by price.
           result.quotes.sort(function (a, b) {
               return a.price - b.price;
           });

           // Filter out library mail, if user requested this.
           that._quotes = result.quotes.filter(function (quote) {
               return quote.service != "Library Mail" || include_library_mail;
           })

           ret.resolve(that._quotes);
        });
    }
);

/**
 * Create a package on the specified sale order.
 *
 * @param sale_order
 * @param package
 */
namespace.Model.prototype.createPackage = decorators.deferrable(function (ret, pkg, sale_id, num_packages) {
    var that = this;

    that._api
        .create_package(pkg, sale_id, num_packages)
        .done(function (response) {
           if (response.success) {
               that._pkg_id = response.id;
               ret.resolve(response);
           } else {
               that._pkg_id = null;
               ret.reject(response);
           }
        });
});

namespace.Model.prototype.getPackList = function (picking_id) {
    this._actionAPI.ir_actions_report_xml({
        "report_name": "stock.picking.list.out", "report_type":"pdf",
        "context": {"active_ids": [picking_id]}
    }, { on_close: function () {} });
}

/**
 * Return a quote in our quotes cache, specified by 0-based index.
 *
 * @param index
 * @returns {*}
 */
namespace.Model.prototype.getQuote = function (index) {
    if (!this._quotes) {
        throw "No quotes to pick from!"
    }

    if ((index % 1) != 0 || index >= this._quotes.length) {
        throw "'" + index + "' is not a valid label index.";
    }
    return this._quotes[index];
};

/**
 * Generates a label from a package ID.
 * If no callback is passed in, it runs synchronously and returns the server's response as an object.
 * If a callback is passed in, it runs asynchronously and passes the server's response to the callback,
 * returning nothing.
 *
 * The callback should expect to take the server's response object as its first argument and an error
 * message as an optional second argument.
 *
 * @param package_id
 * @param quote
 * @param callback (optional)
 * @returns undefined || {{*}}
 */
namespace.Model.prototype.getLabelByPackageID = decorators.deferrable(function (ret, package_id, quote, customs) {
    this._api.get_label_by_package_id(package_id, quote, customs)
        .done(function (result) {
            if (!result || !result.label) {
                ret.reject(result, "Unable to generate label!");
            } else {
                ret.resolve(result);
            }
        });
});

/**
 * Generates a label from a package object.
 * If no callback is passed in, it runs synchronously and returns the server's response as an object.
 * If a callback is passed in, it runs asynchronously and passes the server's response to the callback,
 * returning nothing.
 *
 * The callback should expect to take the server's response object as its first argument and an error
 * message as an optional second argument.
 *
 * @param package_id
 * @param quote
 * @param callback (optional)
 * @returns undefined || {{*}}
 */
namespace.Model.prototype.getLabelByPackage = decorators.deferrable(function (ret, pkg, from_address, to_address, quote, customs) {
    this._api.get_label_by_package(pkg, from_address, to_address, quote, customs)
        .done(function (result) {
            if (!result || !result.label) {
                ret.reject(result, "Unable to generate label!");
            } else {
                ret.resolve(result);
            }
        });
});


/**
 * Sends data of the specified format to the printer proxy.
 *
 * @param format
 * @param data
 * @param callback (optional)
 * @returns undefined || {{ weight: *, unit: * }}
 */
namespace.Model.prototype.print = decorators.deferrable(function (ret, format, data) {
    ret.resolve(this._printerAPI.print(format, data));
});

/**
 * Optionally takes a user ID and returns the user's QuickShip ID.
 * If no user ID is passed in, returns the current user's QuickShip ID.
 *
 * @param user_id (optional)
 * @return quickship_id
 */
namespace.Model.prototype.getQuickshipID = decorators.deferrable(function (ret, user_id) {
    this._api.get_quickship_id(user_id)
        .done(function (quickship_id) {
            ret.resolve(quickship_id);
        })
        .fail(function (response) {
            ret.reject(response);
        });
});