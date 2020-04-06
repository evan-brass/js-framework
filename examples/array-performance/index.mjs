import html from '../../src/templating/html.mjs';
import mount from '../../src/templating/mount.mjs';
import NodeArray from '../../src/templating/users/node-array.mjs';
import on from '../../src/templating/users/on.mjs';
import ref from '../../src/templating/users/ref.mjs';

import LiveData from '../../src/reactivity/live-data.mjs';

const listItems = new NodeArray([]);
let ul;
const data = {};
const n = new LiveData(500);
const currentTest = new LiveData();
const currentStatus = new LiveData();

async function runTests(setup, cleanup, tests) {
	function status(description, color) {
		currentStatus.value = html`<b style="color: ${color}">${description}</b>`;
	}
	function idle() {
		return new Promise(res => requestIdleCallback(res));
	}
	for (const [description, run] of tests) {
		currentTest.value = html`${description}`;
		const timeArray = [];
		const reflowArray = [];
		for (let i = 0; i < n.value; ++i) {
			status(`Testing: ${description}...`, '#dd7373');
			let ret = setup();
			performance.mark('start-run');
			run(ret);
			performance.measure('run-time', 'start-run');
			status(`Reflowing: ${description}...`, '#3b3561');
			performance.mark('start-reflow');
			ul.getBoundingClientRect(); // Force a reflow
			performance.measure('reflow-time', 'start-reflow');
			status(`Cleaning Up: ${description}...`, '#d1d1d1');
			cleanup();
			timeArray.push(performance.getEntriesByName('run-time')[0].duration);
			reflowArray.push(performance.getEntriesByName('reflow-time')[0].duration);
			performance.clearMarks();
			performance.clearMeasures();
			status('Waiting to start next round...', '#ead94c');
			// await animation();
			await idle();
		}

		data[description.slice(0, 1)] = {
			timeArray,
			reflowArray
		};
	}
	status('Finished - Results in the console', '307473');
	let csv = '';
	const names = Object.keys(data);
	csv += names.join(', ') + '\n';
	while (data[names[0]].timeArray.length) {
		csv += names.map(name => data[name].timeArray.pop()).join(', ') + '\n';
	}
	console.log(csv);
	csv = names.join(', ') + '\n';
	while (data[names[0]].reflowArray.length) {
		csv += names.map(name => data[name].reflowArray.pop()).join(', ') + '\n';
	}
	console.log(csv);
}

mount(html`
	<h2>Node Array Performance Tests:</h2>
	Sample size (n): <input type="number" value="${n.value}" ${on('input', e => n.value = e.target.valueAsNumber)}><br>
	<button ${on('click', () => runTests(function setup() {
		let els = [];
		for (let j = 1; j <= 1000; ++j) {
			let el = document.createElement('li');
			el.innerText = Math.random() * 500;
			els.push(el);
		}
		return els;
	}, function cleanup() {
		// Clear the listItems node-array
		listItems.array.length = 0;
		// Clear any li's from the straight javascript version
		ul.querySelectorAll('li').forEach(el => el.remove());
	}, [
		// ["Customized Implementation", listItems.push.bind(listItems)],
		['Native Implementation', Array.prototype.push.bind(listItems.array)],
		['Straight ECMAScript', els => {
			for (const node of els) ul.appendChild(node);
		}]
	]))}>Push 1000 Tests</button>
	<h2>${currentTest}</h2>
	<p>${currentStatus}</p>
	<ul ${ref(el => {
		ul = el;
		// runTests();
	})}>
		${listItems}
	</ul>
`, document.body);