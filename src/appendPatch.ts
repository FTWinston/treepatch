import { applyPatch } from './applyPatch';
import { getArrayChildIndexAdjustment } from './getArrayChildIndexAdjustment';
import { ArrayPatch, MapKey, Patch } from './Patch';
import { isSet } from './typeChecks';
import { updateArrayPatchChildIndexes } from './updateArrayPatchChildIndexes';

function deleteMultiple<TKey>(deleteFrom: Map<TKey, unknown> | Set<TKey>, toDelete: Set<TKey> | IterableIterator<TKey>) {
    for (const key of toDelete) {
        deleteFrom.delete(key);
    }
}

function addMultipleToSet<TKey>(addTo: Set<TKey>, toAdd: Set<TKey> | IterableIterator<TKey>) {
    for (const key of toAdd) {
        addTo.add(key);
    }
}

function addMultipleToMap<TKey, TValue>(addTo: Map<TKey, TValue>, toAdd: Map<TKey, TValue>) {
    for (const [key, value] of toAdd) {
        addTo.set(key, value);
    }
}

/**
 * Merge a newer patch into an older one, updating it so that it contains all changes from both patches.
 * @param target The older patch, which will be updated with the addition.
 * @param addition The newer patch, which will be merged into the target.
 */
export function appendPatch(target: Patch, addition: Patch) {
    // Add deletions, and potentially remove existing settings or child patches.
    if ('d' in addition && addition.d !== undefined) {
        if (isSet(addition.d)) {
            // Add to target.d, and remove corresponding entries from target.s and target.c
            if ('d' in target && isSet(target.d)) {
                addMultipleToSet(target.d, addition.d);
            }
            else {
                (target as any).d = addition.d;
            }

            if ('s' in target && target.s !== undefined) {
                deleteMultiple(target.s, addition.d);
            }
            else if ('a' in target && target.a !== undefined) {
                deleteMultiple(target.a, addition.d);
            }

            if ('c' in target && target.c !== undefined) {
                deleteMultiple(target.c, addition.d);
            }
        }
        else {
            // As addition.d is true, make target.d true, and clear target.s.
            (target as any).d = true;

            if ('s' in target && target.s !== undefined) {
                target.s.clear();
            }
            else if ('a' in target && target.a !== undefined) {
                target.a.clear();
            }
        }
    }

    // Add settings, and potentially remove existing deletions or child patches.
    if ('s' in addition && addition.s !== undefined) {
        // Add to target.s, and remove corresponding entries from target.d and target.c
        if ('s' in target && target.s !== undefined) {
            addMultipleToMap(target.s, addition.s);
        }
        else {
            (target as any).s = addition.s;
        }

        if ('d' in target && isSet(target.d)) {
            deleteMultiple(target.d, addition.s.keys());
        }

        if ('c' in target && target.c !== undefined) {
            deleteMultiple(target.c, addition.s.keys());
        }
    }
    else if ('a' in addition && addition.a !== undefined) {
        // Add to target.a, and remove corresponding entries from target.d
        if ('a' in target && target.a !== undefined) {
            addMultipleToSet(target.a, addition.a);
        }

        if ('d' in target && isSet(target.d)) {
            deleteMultiple(target.d, addition.a);
        }
    }

    // Add array operations, potentially updating existing child patches, as their indexes must be changed.
    if ('o' in addition && addition.o !== undefined) {
        if ('o' in target && target.o !== undefined) {
            target.o = [...target.o, ...addition.o];
        }
        else {
            (target as ArrayPatch).o = addition.o;
        }

        if ('c' in target && target.c !== undefined) {
            // For each operation in addition.o, determine how it would update array indexes, and then apply that to target.c keys.
            // We do this because addition.o operations will be processed before target.c, which previously didn't account for them.
            for (const operation of addition.o) {
                const getNewIndex = getArrayChildIndexAdjustment(operation);
                if (getNewIndex !== null) {
                    updateArrayPatchChildIndexes(target as ArrayPatch, getNewIndex);
                }
            }
        }
    }

    // Add child patches, potentially updating corresponding existing child patches.
    if ('c' in addition && addition.c !== undefined) {
        // Add to target.c, unless we should instead update an existing entry in target.c or target.s
        const targetC = 'c' in target && target.c !== undefined
            ? target.c
            : new Map<MapKey, Patch>();

        for (const [key, childPatch] of addition.c) {
            const targetPatchValue = targetC.get(key);

            if (targetPatchValue !== undefined) {
                // Target already has a patch for this child, so combine the two patches.
                appendPatch(targetPatchValue, childPatch);
                continue;
            }
            else if ('s' in target && target.s !== undefined) {
                const targetSetValue = target.s.get(key as string);

                if (targetSetValue !== undefined) {
                    // Target sets this value, so just apply this child patch to that.
                    applyPatch(targetSetValue, childPatch);
                    continue;
                }
            }
            
            // Add to target.c
            targetC.set(key, childPatch);
        }

        if (targetC.size > 0) {
            (target as any).c = targetC;
        }
    }
}