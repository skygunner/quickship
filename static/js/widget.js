openerp.quickship.QuickShipWidget = (function () {
    var stateBitmasks = {
        "none": 0,
        "scanned": 1,
        "weighed": 2,
        "awaitingLabel": 4,
        "labelSelected": 8
    }

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
        that._completionBitmask = stateBitmasks.none;

        // Keyboard/keyboard scanner input capturing.
        $(document).on("keypress", function (e) {
            if (!that.isActive()) {
                that.inputs.keyboard = "";
                return;
            }

            if (e.keyCode == 13) {
                if (that.hasState(stateBitmasks.awaitingLabel)) {
                    that.trigger("labelSelected", [that.inputs.keyboard]);
                    that.updateCompletionBitmask(stateBitmasks.labelSelected);
                } else {
                    that.trigger("scanned", [that.inputs.keyboard]);
                }
                that.inputs.keyboard = "";
            } else {
                that.inputs.keyboard += String.fromCharCode(e.charCode);
            }
        });
    };

    QuickShipWidget.prototype.updateCompletionBitmask = function (bitmask) {
        this._completionBitmask |= bitmask;

        if (this.hasState(stateBitmasks.scanned) && this.hasState(stateBitmasks.weighed)) {
            this.trigger("inputComplete", [this.inputs]);
            this._completionBitmask = stateBitmasks.awaitingLabel;
        }

        if (this.hasState(stateBitmasks.labelSelected)) {
            this._completionBitmask = stateBitmasks.none; // Reset bitmask.
        };
    };

    QuickShipWidget.prototype.on = function (event, handler) {
        $(this).on("quickship." + event, handler);
    };

    QuickShipWidget.prototype.trigger = function (event, params) {
        $(this).trigger("quickship." + event, params);

        if (event in stateBitmasks) {
            this.updateCompletionBitmask(stateBitmasks[event]);
        }
    };

    QuickShipWidget.prototype.hasState = function (state) {
        return (state | this._completionBitmask) == this._completionBitmask;
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
        that.scale.weigh(that.scaleTimeout, "1.94 kg")
        .done(function (result) {
            that.inputs.weight = {
                value: result.weight,
                unit: result.unit
            };
            that.trigger("weighed", that.inputs.weight);
            that.updateCompletionBitmask(stateBitmasks.weighed);

            if (that.isActive()) {
                that._pollScale();
            }
        });
    };

    return QuickShipWidget;
})();