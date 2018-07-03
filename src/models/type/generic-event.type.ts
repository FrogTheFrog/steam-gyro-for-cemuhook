export type GenericEvent<O, V = {
    [K in keyof O]: {
        event: K,
        value: O[K],
    }
}> = V[keyof V];
