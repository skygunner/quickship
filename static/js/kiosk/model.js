var namespace = new Namespace('ryepdx.openerp.quickship.kiosk');
var decorators = ryepdx.async.decorators;

/**
 * Handles communicating with the servers and providing data for the Controller class.
 *
 * @param api
 * @constructor
 */
namespace.Model = function Model (api, printerAPI, scaleAPI) {
    this._api = api;
    this._printerAPI = printerAPI;
    this._scaleAPI = scaleAPI;
    this._package_id = null;
    this.reset();
};

/**
 * Clear out stateful data.
 */
namespace.Model.prototype.reset = function () {
    this._quotes = [];
    this._package_id = null;
}

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
        });
});

/**
 * Returns the user's Endicia/USPS account status.
 *
 * @param callback (optional)
 * @return {{*}}
 */
namespace.Model.prototype.getUspsAccount = decorators.deferrable(function (ret) {
    ret.resolve(this._api.usps_rpc('account_status'));
});

/**
 * Takes a box code and returns that box's dimensions.
 *
 * @param box_code
 * @param callback (optional)
 * @returns {{length: number, width: number, height: number}}
 */
namespace.Model.prototype.getBoxDimensions = decorators.deferrable(function (ret, box_code) {
    ret.resolve({
        length: 10,
        width: 10,
        height: 10
    });
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
    function (ret, sale_order, package, include_library_mail) {
        var that = this;

        that._api
        .create_package(sale_order, package)
        .done(function (response) {
           if (response.success) {
               that._package_id = response.id;

               that._api
               .get_quotes(that._package_id)
               .done(function (result) {
                   that._quotes = [];

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
           } else {
               that._package_id = null;
               ret.reject(response);
           }
        });
    }
);

/**
 * Return a quote in our quotes cache, specified by 0-based index.
 *
 * @param index
 * @returns {*}
 */
namespace.Model.prototype.getQuote = function (index) {
    if (!this._package_id) {
        throw "No active package!"
    }

    if ((index % 1) != 0 || index >= this._quotes.length) {
        throw "'" + index + "' is not a valid label index.";
    }
    return this._quotes[index];
};

/**
 * Returns the ID of the package we're currently operating on.
 *
 * @returns {null|*}
 */
namespace.Model.prototype.getPackageID = function () {
    return this._package_id;
}

/**
 * Generates a label from a label quote.
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
namespace.Model.prototype.getLabel = decorators.deferrable(function (ret, package_id, quote) {
    this._api.get_label(package_id, quote)
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