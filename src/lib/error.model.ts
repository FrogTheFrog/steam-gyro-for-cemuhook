export interface NonfatalError {
    title: string,
    description: string,
    error: {
        code: string | number,
        message: string,
        stack: string
    }
}