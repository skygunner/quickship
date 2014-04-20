openerp.quickship.QuickShipWidget = (function () {
    var INCOMPLETE = 0;
    var SCAN_COMPLETE = 1;
    var WEIGH_COMPLETE = 2;
    var INPUT_COMPLETE = 3;

    var QuickShipWidget = function (scale, scaleTimeout) {
        var that = this;
        that.scale = scale;
        that.scaleTimeout = scaleTimeout ? scaleTimeout : 2; // Long-polling timeout in seconds.
        that.lastKeyPressed = 0;
        that.inputs = {
            barcode: "",
            weight: {
                value: 0.0,
                unit: "pound"
            }
        };
        that._completionBitmask = INCOMPLETE;
        that.activate();

        // Barcode scanner input capturing.
        $(document).on("keypress", function (e) {
            if (e.keyCode == 13) {
                that.trigger("scan", [that.inputs.barcode]);
                that.updateCompletionBitmask(SCAN_COMPLETE);
                that.inputs.barcode = "";
            } else {
                that.inputs.barcode += String.fromCharCode(e.charCode);
            }
        });

        // Probably not necessary, buuut...
        $(document).focus();
    };

    QuickShipWidget.prototype.updateCompletionBitmask = function (bitmask) {
        this._completionBitmask |= bitmask;

        if (this.inputComplete()) {
            this.trigger("inputComplete", [this.inputs]);
            this._completionBitmask = INCOMPLETE; // Reset bitmask.
        }
    };

    QuickShipWidget.prototype.on = function (event, handler) {
        $(this).on("quickship." + event, handler);
    };

    QuickShipWidget.prototype.trigger = function (event, params) {
        $(this).trigger("quickship." + event, params);
    };

    QuickShipWidget.prototype.inputComplete = function () {
        return this._completionBitmask == INPUT_COMPLETE;
    }

    QuickShipWidget.prototype.activate = function () {
        this._active = true;

        // Start scale input capturing.
        this._pollScale();
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
            that.trigger("weigh", that.inputs.weight);
            that.updateCompletionBitmask(WEIGH_COMPLETE);

            if (that._active) {
                that._pollScale();
            }
        });
    };

    return QuickShipWidget;
})();