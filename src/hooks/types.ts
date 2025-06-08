// types.ts
export type Theta = (t: number) => Record<string, number>;
export type FuncWithTheta = (theta: Theta, t_i: number) => (t: number) => number;
