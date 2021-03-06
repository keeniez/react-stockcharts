"use strict";

import {
	first,
	last,
	getClosestItemIndexes,
	isDefined,
	isNotDefined,
	identity,
} from "../utils";

const debug = false;

function extentsWrapper(data, inputXAccessor, realXAccessor, useWholeData) {
	function domain(inputDomain, xAccessor, initialXScale, currentPlotData, currentDomain) {
		if (useWholeData) {
			return { plotData: data, domain: inputDomain };
		}

		var left = first(inputDomain);
		var right = last(inputDomain);

		var filteredData = getFilteredResponse(data, left, right, xAccessor);

		var realInputDomain = realXAccessor === xAccessor ? inputDomain : [realXAccessor(first(filteredData)), realXAccessor(last(filteredData))];

		var xScale = initialXScale.copy().domain(realInputDomain);

		var width = Math.floor(xScale(realXAccessor(last(filteredData)))
			- xScale(realXAccessor(first(filteredData))));

		var plotData, domain;

		var chartWidth = last(xScale.range()) - first(xScale.range());

		if (debug) console.debug(`Trying to show ${filteredData.length} in ${width}px, I can show up to ${showMax(width)} in that width. Also FYI the entire chart width is ${chartWidth}px`);

		if (canShowTheseManyPeriods(width, filteredData.length)) {
			plotData = filteredData;
			domain = realInputDomain;
			if (debug) console.debug("AND IT WORKED");
		} else {
			plotData = currentPlotData || filteredData.slice(filteredData.length - showMax(width));
			domain = currentDomain || [realXAccessor(first(plotData)), realXAccessor(last(plotData))];

			var newXScale = xScale.copy().domain(domain);
			var newWidth = Math.floor(newXScale(realXAccessor(last(plotData)))
				- newXScale(realXAccessor(first(plotData))));

			if (debug) console.debug(`and ouch, that is too much, so instead showing ${plotData.length} in ${newWidth}px`);
		}

		return { plotData, domain };
	}

	return domain;
}

function canShowTheseManyPeriods(width, arrayLength) {
	var threshold = 2; // number of datapoints per 1 px
	return arrayLength > 1 && arrayLength < width * threshold;
}

function showMax(width) {
	var threshold = 1.80; // number of datapoints per 1 px
	return Math.floor(width * threshold);
}

function getFilteredResponse(data, left, right, xAccessor) {
	var newLeftIndex = getClosestItemIndexes(data, left, xAccessor).right;
	var newRightIndex = getClosestItemIndexes(data, right, xAccessor).left;

	var filteredData = data.slice(newLeftIndex, newRightIndex + 1);
	// console.log(right, newRightIndex, dataForInterval.length);

	return filteredData;
}

function compose(funcs) {
	if (funcs.length === 0) {
		return identity;
	}

	if (funcs.length === 1) {
		return funcs[0];
	}

	var [head, ...tail] = funcs;

	return args => tail.reduce((composed, f) => f(composed), head(args));
}

export default function() {

	var xAccessor, useWholeData, width, xScale,
		map, calculator = [], scaleProvider,
		indexAccessor, indexMutator;

	function evaluate(data) {

		if (process.env.NODE_ENV !== "production") {
			if (debug) console.time("evaluation");
		}
		var mappedData = data.map(map);

		var composedCalculator = compose(calculator);

		var calculatedData = composedCalculator(mappedData);

		if (process.env.NODE_ENV !== "production") {
			if (debug) console.timeEnd("evaluation");
		}


		if (isDefined(scaleProvider)) {
			var scaleProvider2 = scaleProvider
				.inputDateAccessor(xAccessor)
				.indexAccessor(indexAccessor)
				.indexMutator(indexMutator);
			var {
				data: finalData,
				xScale: modifiedXScale,
				xAccessor: realXAccessor,
				displayXAccessor
			} = scaleProvider2(calculatedData);

			return {
				filterData: extentsWrapper(finalData, xAccessor, realXAccessor, useWholeData || isNotDefined(modifiedXScale.invert)),
				fullData: finalData,
				xScale: modifiedXScale,
				xAccessor: realXAccessor,
				displayXAccessor,
				lastItem: last(finalData),
				firstItem: first(finalData),
			};
		}

		return {
			filterData: extentsWrapper(calculatedData, xAccessor, xAccessor, useWholeData || isNotDefined(xScale.invert)),
			fullData: calculatedData,
			xScale,
			xAccessor,
			displayXAccessor: xAccessor,
			lastItem: last(calculatedData),
			firstItem: first(calculatedData),
		};
	}
	evaluate.xAccessor = function(x) {
		if (!arguments.length) return xAccessor;
		xAccessor = x;
		return evaluate;
	};
	evaluate.map = function(x) {
		if (!arguments.length) return map;
		map = x;
		return evaluate;
	};
	evaluate.indexAccessor = function(x) {
		if (!arguments.length) return indexAccessor;
		indexAccessor = x;
		return evaluate;
	};
	evaluate.indexMutator = function(x) {
		if (!arguments.length) return indexMutator;
		indexMutator = x;
		return evaluate;
	};
	evaluate.scaleProvider = function(x) {
		if (!arguments.length) return scaleProvider;
		scaleProvider = x;
		return evaluate;
	};
	evaluate.xScale = function(x) {
		if (!arguments.length) return xScale;
		xScale = x;
		return evaluate;
	};
	evaluate.useWholeData = function(x) {
		if (!arguments.length) return useWholeData;
		useWholeData = x;
		return evaluate;
	};
	evaluate.width = function(x) {
		if (!arguments.length) return width;
		width = x;
		return evaluate;
	};
	evaluate.calculator = function(x) {
		if (!arguments.length) return calculator;
		calculator = x;
		return evaluate;
	};

	return evaluate;
}
