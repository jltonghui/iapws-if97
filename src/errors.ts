import { IF97Error, type Region } from './types.js';

export class SaturationEndpointError extends IF97Error {}

export class NumericalStateError extends IF97Error {}

export class RegionMismatchError extends IF97Error {
  constructor(
    public readonly solverName: string,
    public readonly actualRegion: Region | -1,
    public readonly expectedRegion: Region,
  ) {
    super(`${solverName} produced a PT state in Region ${actualRegion}, not Region ${expectedRegion}`);
  }
}
