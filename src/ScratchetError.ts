export class ScratchetError extends Error {
  date;

  constructor(...args) {
    super(...args);

    this.name = this.constructor.name;
    this.date = new Date();
  }
}
