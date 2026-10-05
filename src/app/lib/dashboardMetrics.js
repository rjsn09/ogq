"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.koreaDay = koreaDay;
exports.koreaWeek = koreaWeek;
exports.dayLabel = dayLabel;
exports.calculateMetrics = calculateMetrics;
var DAY = 86400000;
function koreaDay(time) {
    return Math.floor((time + 9 * 3600000) / DAY);
}
function koreaWeek(time) {
    var day = koreaDay(time);
    return day - (day + 3) % 7; // Monday, Korea time
}
function dayLabel(day) {
    return new Date(day * DAY).toISOString().slice(0, 10);
}
function calculateMetrics(events, details, now, days) {
    var _a;
    if (days === void 0) { days = 14; }
    var today = koreaDay(now);
    var valid = events.filter(function (event) { return event.uid && Number.isFinite(event.createdAt) && event.createdAt <= now; });
    var inPeriod = valid.filter(function (event) { return koreaDay(event.createdAt) >= today - days + 1; });
    var activeTypes = new Set(["generation_start", "generation_complete", "generation_fail", "generation_cancel"]);
    var activeCount = function (period) { return new Set(valid.filter(function (event) { return koreaDay(event.createdAt) >= today - period + 1 && activeTypes.has(event.type); }).map(function (event) { return event.uid; })).size; };
    var visits = inPeriod.filter(function (event) { return event.type === "visit"; });
    var visitors = new Set(visits.map(function (event) { return event.uid; }));
    var starts = new Set();
    var completions = new Set();
    var returns = new Set();
    // Ordered, unique-user funnel. Later stages must follow the preceding stage.
    var stage = new Map();
    for (var _i = 0, _b = __spreadArray([], inPeriod, true).sort(function (a, b) { return a.createdAt - b.createdAt; }); _i < _b.length; _i++) {
        var event_1 = _b[_i];
        if (event_1.type === "visit" && !stage.has(event_1.uid))
            stage.set(event_1.uid, { visit: event_1.createdAt });
        var user = stage.get(event_1.uid);
        if (!user)
            continue;
        if (event_1.type === "generation_start" && user.start === undefined) {
            user.start = event_1.createdAt;
            starts.add(event_1.uid);
        }
        if (event_1.type === "generation_complete" && user.start !== undefined && user.complete === undefined) {
            user.complete = event_1.createdAt;
            completions.add(event_1.uid);
        }
        if (event_1.type === "visit" && user.complete !== undefined && koreaDay(event_1.createdAt) > koreaDay(user.complete))
            returns.add(event_1.uid);
    }
    var terminal = inPeriod.filter(function (event) { return ["generation_complete", "generation_fail", "generation_cancel"].includes(event.type); });
    var completeCount = terminal.filter(function (event) { return event.type === "generation_complete"; }).length;
    var failCount = terminal.filter(function (event) { return event.type === "generation_fail"; }).length;
    var cancelCount = terminal.filter(function (event) { return event.type === "generation_cancel"; }).length;
    var returningVisitors = new Set(visits.filter(function (event) {
        var _a;
        var first = (_a = details.find(function (detail) { return detail.uid === event.uid; })) === null || _a === void 0 ? void 0 : _a.firstVisitAt;
        return first != null && koreaDay(event.createdAt) > koreaDay(first);
    }).map(function (event) { return event.uid; }));
    var daily = Array.from({ length: days }, function (_, index) {
        var day = today - days + 1 + index;
        var rows = inPeriod.filter(function (event) { return koreaDay(event.createdAt) === day; });
        return { date: dayLabel(day).slice(5), visitors: new Set(rows.filter(function (event) { return event.type === "visit"; }).map(function (event) { return event.uid; })).size, active: new Set(rows.filter(function (event) { return activeTypes.has(event.type); }).map(function (event) { return event.uid; })).size, complete: rows.filter(function (event) { return event.type === "generation_complete"; }).length };
    });
    var visitWeeks = new Map();
    for (var _c = 0, _d = valid.filter(function (event) { return event.type === "visit"; }); _c < _d.length; _c++) {
        var event_2 = _d[_c];
        if (!visitWeeks.has(event_2.uid))
            visitWeeks.set(event_2.uid, new Set());
        visitWeeks.get(event_2.uid).add(koreaWeek(event_2.createdAt));
    }
    var currentWeek = koreaWeek(now);
    var cohorts = Array.from({ length: 7 }, function (_, index) {
        var week = currentWeek - (6 - index) * 7;
        var users = details.filter(function (detail) { return detail.firstVisitAt != null && koreaWeek(detail.firstVisitAt) === week; });
        return { week: dayLabel(week), size: users.length, retention: Array.from({ length: 5 }, function (_, offset) {
                if (!users.length || week + offset * 7 >= currentWeek)
                    return null;
                var count = offset === 0 ? users.length : users.filter(function (user) { var _a; return (_a = visitWeeks.get(user.uid)) === null || _a === void 0 ? void 0 : _a.has(week + offset * 7); }).length;
                return { count: count, rate: count / users.length * 100 };
            }) };
    });
    var observed = cohorts.filter(function (cohort) { return cohort.retention[1] !== null; });
    var eligible = observed.reduce(function (sum, cohort) { return sum + cohort.size; }, 0);
    var retained = observed.reduce(function (sum, cohort) { return sum + cohort.retention[1].count; }, 0);
    var funnel = [{ label: "방문", count: visitors.size }, { label: "생성 시작", count: starts.size }, { label: "생성 완료", count: completions.size }, { label: "완료 후 재방문", count: returns.size }].map(function (item, index, all) { return (__assign(__assign({}, item), { dropRate: index === 0 || all[index - 1].count === 0 ? null : (1 - item.count / all[index - 1].count) * 100 })); });
    var biggestDrop = (_a = funnel.slice(1).filter(function (item) { return item.dropRate !== null; }).sort(function (a, b) { return b.dropRate - a.dropRate; })[0]) !== null && _a !== void 0 ? _a : null;
    var previous = valid.filter(function (event) { return koreaDay(event.createdAt) >= today - days * 2 + 1 && koreaDay(event.createdAt) < today - days + 1; });
    var previousCompleteUsers = new Set(previous.filter(function (event) { return event.type === "generation_complete"; }).map(function (event) { return event.uid; })).size;
    return { dau: activeCount(1), wau: activeCount(7), mau: activeCount(30), daily: daily, cohorts: cohorts, funnel: funnel, biggestDrop: biggestDrop, completeCount: completeCount, failCount: failCount, cancelCount: cancelCount, successRate: completeCount + failCount ? completeCount / (completeCount + failCount) * 100 : null,
        returnRate: visitors.size ? returningVisitors.size / visitors.size * 100 : null,
        weekRetention: eligible ? retained / eligible * 100 : null, eligible: eligible, retained: retained, completeUsers: new Set(inPeriod.filter(function (event) { return event.type === "generation_complete"; }).map(function (event) { return event.uid; })).size, previousCompleteUsers: previousCompleteUsers,
    };
}
