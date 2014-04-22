openerp.quickship.QuickShipWidget = (function () {

    var QuickShipWidget = function (scale, scaleTimeout) {
        var that = this;
        that.scale = scale;
        that.scaleTimeout = scaleTimeout ? scaleTimeout : 2; // Long-polling timeout in seconds.
        that.lastKeyPressed = 0;
        that.inputs = {
            keyboard: "",
            weight: {
                value: 0.0,
                unit: "pound"
            }
        };
        that.resetState();

        // Keyboard/keyboard scanner input capturing.
        $(document).on("keypress", function (e) {
            if (!that.isActive()) {
                that.inputs.keyboard = "";
                return;
            }

            if (e.keyCode == 13) {
                if (that.state.awaitingLabel) {
                    that.trigger("labelSelected", [that.inputs.keyboard]);
                } else {
                    that.trigger("scanned", [that.inputs.keyboard]);

                    if (that.state.weighed && !that.state.awaitingLabel) {
                        that.trigger("awaitingLabel", [that.inputs]);
                    }
                }
                that.inputs.keyboard = "";
            } else {
                that.inputs.keyboard += String.fromCharCode(e.charCode);
            }
        });
    };

    QuickShipWidget.prototype.resetState = function () {
        this.state = {
            scanned: false,
            weighed: false,
            awaitingLabel: false,
            labelSelected: false
        }
    };

    QuickShipWidget.prototype.on = function (event, handler) {
        $(this).on("quickship." + event, handler);
    };

    QuickShipWidget.prototype.trigger = function (event, params) {
        $(this).trigger("quickship." + event, params);

        if (event in this.state) {
            this.state[event] = true;
        }
    };

    QuickShipWidget.prototype.isActive = function () {
        return this._active;
    };

    QuickShipWidget.prototype.activate = function () {
        this._active = true;

        // Start scale input capturing.
        this._pollScale();

        // Probably not necessary, buuut...
        $(document).focus();
    };

    QuickShipWidget.prototype.deactivate = function () {
        this._active = false;
    };

    QuickShipWidget.prototype._pollScale = function () {
        var that = this;

        // Scale input capturing.
        // "inf" = wait until the scale returns something, no timeouts.
        that.scale.weigh(that.scaleTimeout)
        .done(function (result) {
            that.inputs.weight = {
                value: result.weight,
                unit: result.unit
            };
            that.trigger("weighed", that.inputs.weight);

            if (that.state.scanned && !that.state.awaitingLabel) {
                that.trigger("awaitingLabel", [that.inputs]);
            }

            if (that.isActive()) {
                that._pollScale();
            }
        });
    };

    return QuickShipWidget;
})();