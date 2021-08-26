# Megapatch

Record changes to an object tree into an efficient json "patch" object, and use this to apply the recorded changes to a different object tree.

When making many changes to a complex object tree, json patch is a fairly inefficient way of recording those changes.
Instead of one patch object per operation, megapatch groups any number of operations into a single "patch" object.
This smartly handles repeated updates of the same object, and array manipulation, to keep the "patch" as small as possible.

## Installation
Run `npm install --save megapatch`

## Usage

Megapatch can record and recreate changes to javascript objects, arrays, Maps and Sets. It cannot recreate classes.

```javascript
import { recordChanges, finishRecording, applyChanges } from 'megapatch';

const data = { existing: [1, 2, 3] };

// The proxy appears identical to the source data.
const proxy = recordChanges(data); 

// All changes should be made via the proxy.
proxy.foo = 1;
proxy.bar = '2';
proxy.existing.push(4);
proxy.someArray = [3, 4];
proxy.someArray.splice(1, 0, 'a', 'b');
proxy.someMap = new Map([[1, 'a'], [2, 'b']]);
proxy.someMap.set(3, 'c');

// Changes made via the proxy update the underlying data.
expect(proxy).toEqual(data);

// Retrieve a "patch" representing all of the recorded changes.
const patch = finishRecording(proxy);

expect(typeof patch).toEqual('string');

// This is identical to hte original data object, before the changes were recorded.
const newData = { existing: [1, 2, 3] };

// Applying changes doesn't mutate existing objects.
const updatedData = applyChanges(newData, patch);

expect(updatedData).toEqual(data);
expect(updatedData).not.toEqual(newData);
```

Megapatch uses [enhanceJSON](https://github.com/FTWinston/enhanceJSON) to stringify and parse JSON.

If you wish to handle stringification yourself, you can use `finishRecordingRaw` instead of `finishRecording`, to return the patch in object format, instead of getting the stringified version.

You will need to stringify this patch yourself. Note that if you don't use `enhanceJSON` to to do, Maps and Sets will not be supported.

The `applyChanges` function will accept a patch object or a stringified patch.