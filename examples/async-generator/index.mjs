import html from '../../src/templating/html.mjs';
import mount from '../../src/templating/mount.mjs';
import LiveData from '../../src/reactivity/live-data.mjs';
import on from '../../src/templating/users/on.mjs';

mount((async function* asyncGenTest() {
	const count = new LiveData();
	count.value = 10;
	yield html`First: Set the count to 25...<br />
		${html`
			<button ${on('click', () => count.value -= 1)}>-</button>
			${count}
			<button ${on('click', () => count.value += 1)}>+</button>
		`}
	`;
	for await (const val of count) {
		if (val == 25) break;
	}
	count.value = 0;
	yield html`
		Next: Set the thingy to 5<br />
		<label>
			${count}
			<input type="range" 
				value="${count.value}" 
				min="0" max="10" step="1" 
				${on('input', e => count.value = e.target.valueAsNumber)}
			/>
		</label>
	`;
	for await (const val of count) {
		if (val == 5) break;
	}
	yield 'Good Job 🎉  Thank you for following along';
})(), document.body);