import on from '../../users/on.mjs';
import html from '../../html.mjs';
import range from '../../lib/range.mjs';
import LiveData from '../../lib/live-data.mjs';
import Subject from '../../lib/subject.mjs';
import delay from '../../lib/delay.mjs';

export default function dial(
    title = "Some Clue", 
    secretMessage = "This is secret", 
    symbols = Array.from(range(1, 10)), 
    passcode = [1,2,3,4]
) {
    const scrollDiffs = new Subject();
    const last_location = new Map()
    return html`
    <section class="dial-container"
        ${ // These events are used to turn the dial:
        on('wheel', e => {
            const Scaler = .5;
            scrollDiffs.yield(e.deltaY * Scaler);
            e.preventDefault();
        })}
        ${on('touchstart', e => {
            for (const touch of e.changedTouches) {
                last_location.set(touch.identifier, touch.clientY);
            }
            e.preventDefault();
        })}
        ${on('touchmove', e => {
            let diff = 0;
            for (let touch of e.changedTouches) {
                diff += touch.clientY - last_location.get(touch.identifier);
                last_location.set(touch.identifier, touch.clientY);
            }
            scrollDiffs.yield(diff);
            e.preventDefault();
        })}
        ${on('touchend', e => {
            for (const touch of e.changedTouches) {
                last_location.delete(touch.identifier);
            }
            e.preventDefault();
        })}
    >
        <h1>${title}</h1>
        <div class="marker">^</div>
        ${(async function*() {
            const degrees = new LiveData();
            degrees.value = 0;
            const digits = passcode.map(_ => new LiveData());
            const digit_status = new LiveData();
            const secret_container = new LiveData();
            
            yield html`
            <div class="dial" style="transform: rotate(-${degrees}deg)">
                ${symbols.map((sym, i) => 
                    html`<span style="transform: translateX(-50%) rotateZ(${(i)*360/symbols.length}deg);">${sym}</span>`
                )}
            </div>
            <div class="digits ${digit_status}">${digits.map(num => 
                html`<span>${num}</span>`
            )}</div>
            <div>
                ${secret_container}
            </div>
            `;
            function normalize_degrees(degrees) {
                // Normalize degrees from any number to an integer between [0, 360)
                return ((degrees % 360) + 360) % 360;
            }
            function degrees_to_symbol(degrees) {
                return symbols[Math.round(normalize_degrees(degrees) * symbols.length / 360) % symbols.length];
            }
                        
            // Behavior:
            let last_diff;

            // Attempt to enter the password
            passcode_enter:
            while (1) {
                for (const digit of digits) {
                    // For every difference from the scroll wheel or touches:
                    for await(const diff of scrollDiffs) {
                        degrees.value = normalize_degrees(degrees.value + diff);
                        digit.value = degrees_to_symbol(degrees.value);
                        if (digits.every((digit, i) => passcode[i] == digit.value)) {
                            // Check if the passcode is correct:
                            break passcode_enter;
                        } else if (last_diff === undefined) {
                            last_diff = diff;
                            continue;
                        } else if ((last_diff < 0 && diff > 0) || (last_diff > 0 && diff < 0)) {
                            // Check if we changed directions and should advance to the next digit
                            last_diff = diff;
                            break;
                        }
                    }
                }
                // If we used all the digits and got it wrong then change the digit container class:
                digit_status.value = "wrong";
                // Apply a penalty time:
                await delay(950);
                // Clear the digits:
                digits.forEach(digit => digit.value = "")
                // Clear the digits container class to nothing
                digit_status.value = "";
            }
            // Passcode is correct.  Change to confirmation class on the digit container:
            digit_status.value = "correct";
            // Display the secret message
            secret_container.value = secretMessage;
        })()}
        <link rel="stylesheet" href="./src/tests/manual/dial.css"></style>
    </section>
    `;
}