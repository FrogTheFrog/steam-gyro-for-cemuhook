/**
 * Position represented by x, y, z.
 */
export interface PositionTriplet {
    x: number;
    y: number;
    z: number;
}

/**
 * Position triplet with range included.
 */
export interface PositionTripletWithRange extends PositionTriplet {
    range: [number, number];
}

/**
 * Motion data.
 */
export interface MotionData {
    accelerometer: PositionTripletWithRange;
    gyro: PositionTripletWithRange;
}

/**
 * Motion data with timestamp.
 */
export interface MotionDataWithTimestamp extends MotionData {
    timestamp: number;
}

/**
 * Motion data with quaternion.
 */
export interface MotionDataWithQuaternion extends MotionDataWithTimestamp {
    quaternion: PositionTripletWithRange & {
        w: number,
    };
}
