/**
 * Generates private data accessor function with its own WeakMap.
 * @returns Private data accessor and initializer.
 */
export function privateData() {
    const data = new WeakMap<any, any>();
    return (self: unknown, init: unknown | void) => {
        let internals = data.get(self);
        if (!internals) {
            if (init === void 0) {
                throw new Error("Initial data not initialized.");
            } else {
                data.set(self, init);
                internals = init;
            }
        }
        return internals as unknown;
    };
}
