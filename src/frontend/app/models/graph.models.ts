/**
 * Graph data item.
 */
export interface GraphDataItem {
    name: number;
    value: number;
}

/**
 * Graph data items per motion data.
 */
export interface MotionDataGraphItem {
    x: GraphDataItem[];
    y: GraphDataItem[];
    z: GraphDataItem[];
}

/**
 * Expected data stream object.
 */
export interface DataStreamObject {
    name: string;
    series: GraphDataItem[];
}
