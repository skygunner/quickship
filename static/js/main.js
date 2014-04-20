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
        create_package: function (sale_order, pkg) {
            return this.model.call("create_package", {
                "sale_order": sale_order,
                "package": pkg
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
        }
    });

    // Client actions
    instance.quickship.create_package = function (parent, action) {
        var api = new instance.quickship.API();
        return api.create_package(action.params.sale_order, action.params.package);
    }
    instance.web.client_actions.add('quickship.create_package', "instance.quickship.create_package");

    instance.quickship.get_label = function (parent, action) {
        var api = new instance.quickship.API();
        return api.create_package(action.params.package_id, action.params.shipping, action.params.test);
    }
    instance.web.client_actions.add('quickship.get_label', "instance.quickship.get_label");

    instance.quickship.get_quotes = function (parent, action) {
        var api = new instance.quickship.API();
        return api.get_quotes(action.params.package_id, action.params.weight, action.params.test);
    }
    instance.web.client_actions.add('quickship.get_quotes', "instance.quickship.get_quotes");

    instance.quickship.WidgetBehaviors = new (function () {
        var that = this;
        that.hash = "";

        var addEvent = function (elem, evnt, func) {
           if (elem.addEventListener)  // W3C DOM
              elem.addEventListener(evnt,func,false);
           else if (elem.attachEvent) { // IE DOM
              elem.attachEvent("on"+evnt, func);
           }
           else { // No much to do
              elem[evnt] = func;
           }
        }

        addEvent(window, "hashchange", function () {
            if (window.location.hash != that.hash) {
                that._quickShipWidget.deactivate();
            }
        });

        var api = new instance.quickship.API();

        this._quickShipWidget = new openerp.quickship.QuickShipWidget(
            new instance.scale_proxy.Scale()
        );


        this._quickShipWidget.on("scan", function (e, code) {
            $("#sale_order").text("Sale Order: " + code);
        });

        this._quickShipWidget.on("weigh", function (e, weight) {
            $("#weight").text(weight.value + " " + weight.unit + "s");
        });

        this._quickShipWidget.on("inputComplete", function (e, inputs) {
            api.create_package(inputs.barcode, {'weight': inputs.weight})
                .done(function (response) {
                   if (response.success) {
                       api.get_quotes(response.id)
                           .done(function (result) {
                               $(result.quotes).each(function (i, quote) {
                                   $("#quotes_list").append("<li>" + quote.service + " - $" + quote.price.toFixed(2) + "</li>");
                               });
                               $("#step-2").show();
                           });

                   } else {
                       console.log(response);
                       instance.web.Notification.warn("Error", "Failed to create package. See JS console for details.");
                   }
                });
        });

        this._quickShipWidget.on("printed", function (e) {
            $("#sale_order").text("Scan another barcode for more quotes...");
            $("#step-2").hide();
        });

        this.activate = function () {
            that._quickShipWidget.activate();
        };

        console.log("constructed");

        return this;
    })();

    instance.quickship.Widget = instance.web.Widget.extend({
        template: "quickship.widget",
        start: function () {
            instance.quickship.WidgetBehaviors.hash = window.location.hash;
            instance.quickship.WidgetBehaviors.activate();
            $("#step-2").hide();
        }
    });

    instance.web.client_actions.add('quickship.Widget', 'instance.quickship.Widget');
};
