"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGenerationTask = useGenerationTask;
var react_1 = require("react");
var sse_1 = require("../../api/sse");
function useGenerationTask() {
    var _this = this;
    var identity = (0, react_1.useRef)({});
    var version = (0, react_1.useRef)(0);
    var _a = (0, react_1.useState)(24), total = _a[0], setTotal = _a[1];
    var _b = (0, react_1.useState)(0), elapsed = _b[0], setElapsed = _b[1];
    var _c = (0, react_1.useState)(null), remaining = _c[0], setRemaining = _c[1];
    var _d = (0, react_1.useState)(false), registered = _d[0], setRegistered = _d[1];
    var _e = (0, react_1.useState)(false), cancelling = _e[0], setCancelling = _e[1];
    var _f = (0, react_1.useState)(false), cancelled = _f[0], setCancelled = _f[1];
    var _g = (0, react_1.useState)(null), cancelError = _g[0], setCancelError = _g[1];
    var begin = (0, react_1.useCallback)(function (count) {
        var current = ++version.current;
        identity.current = {};
        setTotal(count);
        setElapsed(0);
        setRemaining(null);
        setRegistered(false);
        setCancelling(false);
        setCancelled(false);
        setCancelError(null);
        var onStatus = function (data) {
            if (version.current !== current)
                return;
            if (typeof data.elapsed_seconds === 'number')
                setElapsed(data.elapsed_seconds);
            setRemaining(typeof data.remaining_seconds === 'number' ? data.remaining_seconds : null);
        };
        return {
            onStart: function (data) {
                if (version.current !== current)
                    return;
                identity.current = data;
                setRegistered(!!(data.job_id || data.canonical_id));
                onStatus(data);
            },
            onStatus: onStatus,
        };
    }, []);
    var cancel = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var current, active, result, stopped, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    current = version.current;
                    active = identity.current;
                    setCancelling(true);
                    setCancelError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, sse_1.cancelGeneration)(active)];
                case 2:
                    result = _a.sent();
                    if (version.current !== current)
                        return [2 /*return*/, false];
                    stopped = result.status === 'cancelled';
                    setCancelled(stopped);
                    return [2 /*return*/, stopped];
                case 3:
                    error_1 = _a.sent();
                    if (version.current === current)
                        setCancelError(error_1 instanceof Error ? error_1.message : '취소 요청에 실패했습니다.');
                    return [2 /*return*/, false];
                case 4:
                    if (version.current === current)
                        setCancelling(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, []);
    return { begin: begin, cancel: cancel, total: total, elapsed: elapsed, remaining: remaining, registered: registered, cancelling: cancelling, cancelled: cancelled, cancelError: cancelError };
}
