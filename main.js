// All data from Colour and Vision Research Lab
//	http://www.cvrl.org/
// files:

// Chromacity coordinates:
//		XX - degree
//		YY - step size (in nm) (fine is 0.1nm)
// mbXX_YY
//		NOTE: these are given in LMS form
//		CIE "physiologically-relevant" functions 
//		based on the Stockman & Sharpe (2000) cone fundamentals
// cc2012xyzXX_YY_5dp
//		New physiologically-relevant CIE x, y chromaticity coordinates (proposed)
// cccie64
//		CIE1964 10degree (step size 5nm)
// cccie64_1
//		CIE1964 10degree (step size 1nm)

// Colour Matching Functions
// lin2012xyzXXe_YY_7sf
//		XYZ CMFs transformed from the CIE (2006) 2-deg LMS cone fundamentals

// There's also the Stiles and Burch ones
// Stiles and Burch 10degree ones are measured directly



// TODO: integral is only supposed to go from 380 to 780
// TODO: just actually do things in integers


// Chromacity coordinates for sRGB
var chromaCoord = {
	red: [0.64, 0.33],
	green: [0.30, 0.60],
	blue: [0.15, 0.06],
	// D65 - approx 6504K
	//white: [0.3127, 0.3290]	// Illuminant D65 - this is for 2 degree observer
	white: [0.31382, 0.33100]	// Illuminant D65 for 10degree
};
// Scrap - given sRGB chroma coordinates were for 2degree
// TODO: choose appropriate chroma coords by selecting wavelength from data
// 		use either the given data or calculate self - shouldn't be too different


window.onload = function() {
	var graphWidth = 600;
	var graphHeight = 400;	// Graphite
	var margin = {top: 20, right: 20, bottom: 30, left: 50};
	var chartWidth = graphWidth - margin.left - margin.right;
	var chartHeight = graphHeight - margin.top - margin.bottom;

	// Canvas stuff
	var canvas = d3.select('#chart')
		.append('canvas')
		.attr('width', graphWidth)
		.attr('height', graphHeight)
		.node();
	var context = canvas.getContext('2d');

	context.fillStyle = "lightblue";
	context.fillRect(0, 0, graphWidth, graphHeight);

	// Canvas might be useless actually
	var svg = d3.select("#chart").append("svg")
		.attr("width", graphWidth)
		.attr("height", graphHeight)
		.style("position", "absolute")
		.style("left", "0")
		.style("top", "0");
	var svgChart = svg.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	var spectrum = [];

	var transform = calculateTransform(chromaCoord);

	getObserver().then(function(observer) {
		var maxValue = Math.max(observer.maxX, observer.maxY, observer.maxZ);
		var xRange = d3.scaleLinear().range([0, chartWidth]).domain([observer.minLength, observer.maxLength]);
		var yRange = d3.scaleLinear().range([chartHeight, 0]).domain([0, maxValue]);


		// Draw spectrum
		var svgElem = svg.node();
		svgElem.addEventListener("mousemove", function(event) {
			if (event.buttons !== 1)
				return;

			var rect = svgElem.getBoundingClientRect();
			var x = event.clientX - rect.left - margin.left;
			var y = event.clientY - rect.top - margin.top;

			var lastX = x - event.movementX;
			var lastY = y - event.movementY;

			var lambda = Math.round(xRange.invert(x));
			var lastLambda = Math.round(xRange.invert(lastX));
			var intensity = yRange.invert(y);
			var lastIntensity = yRange.invert(lastY);
			

			var dLambda = lambda - lastLambda;
			var n = Math.abs(dLambda) + 1;
			//var sign = d3.ascending
			var sign = Math.sign(dLambda);

			var val = d3.quantize(d3.interpolateNumber(lastIntensity, intensity), n);
			for (var i = lastLambda, ii = 0; i != lambda; i += sign, ii++) {
				spectrum[i] = val[ii];
			}

			spectrum[lambda] = intensity;

			// Update
			d3.selectAll(".spectrum").attr("d", d3.line().x((d, i) => xRange(i)).y((d, i) => yRange(d || 0))(spectrum));


			var stimulus = observer.calculateStimulus(spectrum);
			updateStimulus(stimulus, transform);
		}, false);

		// Add axes
		var xAxis = d3.axisBottom(xRange);
		var yAxis = d3.axisLeft(yRange);
		svgChart.append("g")
			.attr("transform", "translate(0," + chartHeight + ")")
			.call(xAxis);
		svgChart.append("g")
			.call(yAxis);


		// Draw the observer functions
		svgChart.append("path")
			.attr("class", "line")
			.attr("d", (d) => d3.line()(
				xRange.ticks(observer.data.length).map(lambda => [xRange(lambda), yRange(observer.x(lambda))])
			))
			.attr("fill", "none")
			.attr("stroke", "red");

		svgChart.append("path")
			.attr("class", "line")
			.attr("d", (d) => d3.line()(
				xRange.ticks(observer.data.length).map(lambda => [xRange(lambda), yRange(observer.y(lambda))])
			))
			.attr("fill", "none")
			.attr("stroke", "green");

		svgChart.append("path")
			.attr("class", "line")
			.attr("d", (d) => d3.line()(
				xRange.ticks(observer.data.length).map(lambda => [xRange(lambda), yRange(observer.z(lambda))])
			))
			.attr("fill", "none")
			.attr("stroke", "blue");


		// Draw spectrum
		svgChart.append("path")
			.attr("class", "line spectrum")
			.attr("fill", "none")
			.attr("stroke", "black");
	});
}

// Returns (a promise of) an object containing standard observer functions x, y, z
// Assumptions:
//	CSV file is in the format (lambda, x, y, z) without headers
//	CSV file is ordered by lambda from smallest to largest
//   Temporary - spacing is exactly integers, increment by one (TEMP - will break later)
// Observer {
//		data: array of {lambda, x, y, z}
//		minLength: minimum observable wavelength in nm
//		maxLength: maximum observable wavelength in nm
//		maxX, maxY, maxZ: maximum intensity
//		x, y, z: color matching functions
//			standard observer
// }
async function getObserver() {
	// CSV parse
	var data = await d3.text("data/lin2012xyz10e_1_7sf.csv").then(text => 
		d3.csvParseRows(text, function(d, i) {
			return {
				wavelength: +d[0],
				x: +d[1],
				y: +d[2],
				z: +d[3]
			};
		})
	);

	var observer = {
		data: data,
		calculateStimulus: function(spectrum) {
			var int_x = 0, int_y = 0, int_z = 0;
			// Spectrum is an array (weird I know) of intensities with the wavelength as the axis (yes, fix this)
			// Also it might (will) have a lot of values as undefined
			for (var lambda = this.minLength; lambda < this.maxLength; lambda++) {
				var intensity = spectrum[lambda] || 0;
				int_x += intensity * this.x(lambda);
				int_y += intensity * this.y(lambda);
				int_z += intensity * this.z(lambda);
			}

			var total = int_x + int_y + int_z;
			var norm_x = int_x/total;
			var norm_y = int_y/total;

			// Temp hack to make the values seem normalish
			// TODO: fix
			var stimulus = {
				X: int_x / 120,
				Y: int_y / 120,
				Z: int_z / 120,
				x: norm_x,
				y: norm_y,
				z: 1 - norm_x - norm_y
			};

			return stimulus;
		}
	};
	var length = observer.data.length;
	var min = observer.minLength = observer.data[0].wavelength;
	var max = observer.maxLength = observer.data[length - 1].wavelength;

	// a bit inelegant, but meh - might actually be able to do this while parsing but meh again
	var maxX = 0, maxY = 0, maxZ = 0;
	for (var i = 0; i < length; i++) {
		var d = observer.data[i];
		if (d.x > maxX) maxX = d.x;
		if (d.y > maxY) maxY = d.y;
		if (d.z > maxZ) maxZ = d.z;
	}
	observer.maxX = maxX;
	observer.maxY = maxY;
	observer.maxZ = maxZ;


	// TODO: fix this - either just make it a direct map or do it properly
	["x", "y", "z"].map(function (func) {
		observer[func] = function(lambda) {
			if (lambda < this.minLength) return 0.0;
			if (lambda > this.maxLength) return 0.0;
			
			if (lambda == this.maxLength) return this.data[this.data.length - 1][func];
			lambda -= this.minLength; // TEMP - fix this FIXME TODO
			
			var x1 = Math.floor(lambda);
			var x2 = x1 + 1;
			var t = lambda - x1;

			// Just a lerp
			return d3.interpolateNumber(this.data[x1][func], this.data[x2][func])(t);
		}
	});

	return observer;
}

function updateStimulus(stimulus, transform) {
	var f = d3.format(".3f");

	d3.select("#raw_value_x").text(f(stimulus.X));
	d3.select("#raw_value_y").text(f(stimulus.Y));
	d3.select("#raw_value_z").text(f(stimulus.Z));

	d3.select("#norm_value_x").text(f(stimulus.x));
	d3.select("#norm_value_y").text(f(stimulus.y));
	d3.select("#norm_value_z").text(f(stimulus.z));

	// Output not guaranteed to be in range 0..1?
	var rgb = transform.XYZ2RGB(stimulus.X, stimulus.Y, stimulus.Z);
	var r = Math.max(0.0, Math.min(1.0, rgb[0]));
	var g = Math.max(0.0, Math.min(1.0, rgb[1]));
	var b = Math.max(0.0, Math.min(1.0, rgb[2]));

	console.log(rgb);

	f = d3.format(".1%");
	var col = `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
	d3.select("#pure_colour").style("background-color", col);
}


function calculateTransform(chromacity) {
	var transform = {};
	var red_xyz = chromacity.red.slice(0, 2);
		red_xyz[2] = 1 - red_xyz[0] - red_xyz[1];
	var green_xyz = chromacity.green.slice(0, 2);
		green_xyz[2] = 1 - green_xyz[0] - green_xyz[1];
	var blue_xyz = chromacity.blue.slice(0, 2);
		blue_xyz[2] = 1 - blue_xyz[0] - blue_xyz[1];
	var white_xyz = chromacity.white.slice(0, 2);
		white_xyz[2] = 1 - white_xyz[0] - white_xyz[1];

	var base = math.transpose([red_xyz, green_xyz, blue_xyz]);
	// [(r_X + r_Y + r_Z) (gX + gY + gZ) ... ]' = [r_xyz g_xyz b_xyz]^(-1) * w_xyz / w_y
	const SCALE = 1.0;
	var rgb_T = math.divide(math.multiply(math.inv(base), white_xyz), white_xyz[1]*SCALE);

	var M = math.multiply(base, math.matrix([
		[rgb_T[0], 0, 0],
		[0, rgb_T[1], 0],
		[0, 0, rgb_T[2]]
	]));

	transform._M_forward = M;	// js has gc, this is fine
	transform._M_backward = math.inv(M);

	transform.RGB2XYZ = function(r, g, b) {
		var XYZ = math.multiply(this._M_forward, math.transpose([r, g, b]));
		return XYZ.toArray();
	};

	transform.XYZ2RGB = function(X, Y, Z) {
		var RGB = math.multiply(this._M_backward, math.transpose([X, Y, Z]));
		return RGB.toArray();
	};

	return transform;
}