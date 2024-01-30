export default class InvalidInputError extends Error {
  constructor(
    message: string,
    public command: string,
  ) {
    super(message);
    this.name = "InvalidInputError";
  }
}
