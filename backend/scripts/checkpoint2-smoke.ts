import { strict as assert } from 'assert';
import {
  supportedStepTypes,
  validateTestStep,
} from '../src/test-definitions/dto/test-step.dto';

async function main() {
  assert.deepEqual(supportedStepTypes, [
    'goto',
    'click',
    'fill',
    'press',
    'select',
    'wait',
    'assertText',
    'assertVisible',
    'assertUrl',
  ]);

  assert.equal(validateTestStep({ type: 'goto', url: '/' }), true);
  assert.equal(validateTestStep({ type: 'click', selector: 'text=Login' }), true);
  assert.equal(
    validateTestStep({ type: 'assertText', selector: 'body', text: 'Dashboard' }),
    true,
  );
  assert.equal(validateTestStep({ type: 'fill', selector: '#email' }), false);
  assert.equal(validateTestStep({ type: 'unknown' }), false);

  console.log('Checkpoint 2 smoke checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
