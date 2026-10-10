/** World generation stopped the way OpenTTD aborts it (the key is an i18n message). */
export class WorldGenerationError extends Error {
  constructor(readonly key: 'error.noTownCreated') {
    super(key);
    this.name = 'WorldGenerationError';
  }
}
