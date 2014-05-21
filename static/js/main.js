openerp.quickship = function (instance) {
    instance.quickship = {};
    instance.quickship.API  = instance.web.Class.extend({
        init: function(options){
            options = options || {};

            this.connection = new instance.web.JsonRPC();
            this.connection.setup(options.url || 'http://localhost:8069');
            this.model = new instance.web.Model('stock.packages');
            this.notifications = {};
        },

        // Makes a JSON-RPC call to the local OpenERP server.
        message : function(name,params){
            var ret = new $.Deferred();
            var callbacks = this.notifications[name] || [];
            for(var i = 0; i < callbacks.length; i++){
                callbacks[i](params);
            }

            this.connection.rpc('/quickship/' + name, params || {}).done(function(result) {
                ret.resolve(result);
            }).fail(function(error) {
                ret.reject(error);
            });
            return ret;
        },

        // Allows triggers to be set for when particular JSON-RPC function calls are made via 'message.'
        add_notification: function(name, callback){
            if(!this.notifications[name]){
                this.notifications[name] = [];
            }
            this.notifications[name].push(callback);
        },

        // Convenience function for creating a new package.
        create_package: function (sale_order, pkg, picker, packer, shipper) {
            return this.model.call("create_package", {
                "sale_order": sale_order,
                "package": pkg,
                "picker_id": picker,
                "packer_id": packer,
                "shipper_id": shipper
            });
        },

        // Convenience function for getting quotes for a package.
        get_quotes: function (package_id, test) {
            var params = {};

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.model.call('get_quotes', [package_id], params);
        },

        // Convenience function for getting the label for a package.
        get_label: function (package_id, shipping, test) {
            var params = {"shipping": shipping};

            if (test !== undefined) {
                params['test'] = test;
            }
            return this.model.call('get_label', [package_id], params);
        },

        // Convenience function for getting lists of pickers, packers, and shippers.
        get_participants: function () {
            return this.model.call('get_participants');
        },

        // Convenience function for getting stats.
        get_stats: function (fromDate, toDate) {
            return this.model.call('get_stats', [fromDate, toDate]);
        }
    });

    // Client actions
    instance.quickship.create_package = function (parent, action) {
        var api = new instance.quickship.API();
        return api.create_package(action.params.sale_order, action.params.package,
            action.params.picker, action.params.packer, action.params.shipper
        );
    }
    instance.web.client_actions.add('quickship.create_package', "instance.quickship.create_package");

    instance.quickship.get_label = function (parent, action) {
        var api = new instance.quickship.API();
        return api.get_label(action.params.package_id, action.params.shipping, action.params.test);
    }
    instance.web.client_actions.add('quickship.get_label', "instance.quickship.get_label");

    instance.quickship.get_quotes = function (parent, action) {
        var api = new instance.quickship.API();
        return api.get_quotes(action.params.package_id, action.params.weight, action.params.test);
    }
    instance.web.client_actions.add('quickship.get_quotes', "instance.quickship.get_quotes");

    instance.quickship.KioskBehaviors = new (function () {
        var that = this;
        that.hash = "";
        that.package_id = null;

        var addEvent = function (elem, evnt, func) {
           if (elem.addEventListener)  // W3C DOM
              elem.addEventListener(evnt,func,false);
           else if (elem.attachEvent) { // IE DOM
              elem.attachEvent("on"+evnt, func);
           }
           else {
              elem[evnt] = func;
           }
        }

        addEvent(window, "hashchange", function () {
            if (that.hash == "") {
                return;
            }

            if (window.location.hash != that.hash) {
                that._quickShipKiosk.deactivate();
            } else {
                that._quickShipKiosk.activate();
            }
        });

        var api = new instance.quickship.API();
        var printerAPI = new instance.printer_proxy.Printer({name: "zebra"});

        this._quickShipKiosk = new openerp.quickship.QuickShipKiosk(
            new instance.scale_proxy.Scale()
        );

        this._quickShipKiosk.on("scanned", function (e, code) {
            $("#sale_order").text("Sale Order: " + code);
        });

        this._quickShipKiosk.on("weighed", function (e, weight) {
            $("#weight").text(weight.value + " " + weight.unit + "s");
        });

        this._quickShipKiosk.on("awaitingLabel", function (e, inputs) {
            var includeLibraryMail = $("#no_library_mail:checked").length == 0;

            api.create_package(inputs.keyboard, {
                'weight': inputs.weight,
                'picker_id': $("#picker option:selected").val(),
                'packer_id': $("#packer option:selected").val(),
                'shipper_id': $("#shipper option:selected").val()
            }).done(function (response) {
               if (response.success) {
                   that.package_id = response.id;

                   api.get_quotes(response.id)
                       .done(function (result) {
                           that.quotes = [];
                           result.quotes.sort(function (a, b) {
                               return a.price - b.price;
                           });

                           $(result.quotes).each(function (i, quote) {
                               if (quote.service != "Library Mail" || includeLibraryMail) {
                                   that.quotes.push(quote);
                                   $("#quotes_list").append(
                                       "<li>" + quote.service + " - $" + quote.price.toFixed(2) + "</li>"
                                   );
                               }
                           });
                           $("#step-2").show();

                           // Auto-select the cheapest quote if requested.
                           if ($("#autoprint:checked").length > 0) {
                               that._quickShipKiosk.trigger("labelSelected", ["1"]);
                           }
                       });

               } else {
                   that.package_id = null;
                   console.log(response);
                   $("#sale_order").text(response.error);
                   that._quickShipKiosk.resetState();
                   $("#step-2").hide();
               }
            });
        });

        this._quickShipKiosk.on("labelSelected", function (e, input) {
            if (!that.package_id) {
                console.log("No active package!");
            }

            if (isNaN(parseFloat(input)) || !isFinite(input)) {
                console.log("'" + input + "' is not a valid number.");
                return;
            }

            var quoteIndex = (parseFloat(input) - 1);
            if ((quoteIndex % 1) != 0 || quoteIndex >= that.quotes.length) {
                console.log("'" + input + "' is not a valid label selection.");
            }

            var quote = that.quotes[quoteIndex];

            api.get_label(that.package_id, quote)
                .done(function (result) {
                    if (result.errors) {
                        console.log(result);
                        instance.web.Notification.warn("Error", "Failed to get label. See JS console for details.")
                    } else {
                        printerAPI.print("EPL2", result.label);
                    }
                });

            that.quotes = [];
            that.package_id = null;
            $("#quotes_list li").remove();
            that._quickShipKiosk.resetState();
            $("#sale_order").text("Scan another barcode for more quotes...");
            $("#step-2").hide();
        });

        this.activate = function () {
            that._quickShipKiosk.activate();
        };

        return this;
    })();

    instance.quickship.Kiosk = instance.web.Widget.extend({
        template: "quickship.kiosk",
        start: function () {
            instance.quickship.KioskBehaviors.hash = window.location.hash;
            instance.quickship.KioskBehaviors.activate();
            $("#step-2").hide();

            var api = new instance.quickship.API();
            var $selects = {
                pickers: $("#picker"),
                packers: $("#packer"),
                shippers: $("#shipper")
            };

            api.get_participants().done(function (response) {
                for (key in response) {
                    for (var i = 0; i < response[key].length; i++) {
                        $selects[key].append("<option value=\"" + response[key][i].id + "\">"
                            + response[key][i].name
                            + "</option>");
                    }
                }
            });
        }
    });
    instance.web.client_actions.add('quickship.Kiosk', 'instance.quickship.Kiosk');

    instance.quickship.Stats = instance.web.Widget.extend({
        template: "quickship.stats",
        start: function () {
            var that = this;

            var refresh_stats = function () {
                var api = new instance.quickship.API();
                api.get_stats($("#from").val(), $("#to").val()).done(function (stats) {
                    var $tbody;
                    var user;

                    for (key in stats) {
                        $tbody = $("#" + key);
                        $("tr", $tbody).remove();

                        for (var i=0; i < stats[key].length; i++) {
                            user = stats[key][i];
                            $tbody.append("<tr><td>" + user.name + "</td>"
                                +"<td class=\"packages\">" + user.package_count + "</td></tr>");
                        }
                    }
                });
            };
            refresh_stats();

            $( "#from:not(.hasDatepicker)" ).datepicker({
              defaultDate: "+1w",
              changeMonth: true,
              numberOfMonths: 2,
              onClose: function( selectedDate ) {
                $( "#to" ).datepicker( "option", "minDate", selectedDate );
                refresh_stats();
              }
            });

            $( "#to:not(.hasDatepicker)" ).datepicker({
              defaultDate: "+1w",
              changeMonth: true,
              numberOfMonths: 2,
              onClose: function( selectedDate ) {
                $( "#from" ).datepicker( "option", "maxDate", selectedDate );
                refresh_stats();
              }
            });
        }
    });
    instance.web.client_actions.add('quickship.Stats', 'instance.quickship.Stats');
};
