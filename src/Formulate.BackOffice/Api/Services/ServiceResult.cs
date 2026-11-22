namespace Formulate.BackOffice.Api.Services
{
    /// <summary>
    /// The outcome of a service call.
    /// </summary>
    public enum ServiceStatus
    {
        /// <summary>
        /// The call succeeded.
        /// </summary>
        Success,

        /// <summary>
        /// The item the call is about does not exist.
        /// </summary>
        NotFound,

        /// <summary>
        /// The request is not valid. <see cref="ServiceResult{T}.Field"/> and <see cref="ServiceResult{T}.Message"/> say why.
        /// </summary>
        Invalid,

        /// <summary>
        /// The request clashes with something that exists.
        /// </summary>
        Conflict,
    }

    /// <summary>
    /// A service result: a status and, on success, a value; otherwise what was wrong.
    /// </summary>
    /// <typeparam name="T">The type of the value.</typeparam>
    public sealed class ServiceResult<T>
    {
        private ServiceResult(ServiceStatus status, T? value, string? field, string? message)
        {
            Status = status;
            Value = value;
            Field = field;
            Message = message;
        }

        /// <summary>
        /// Gets the status.
        /// </summary>
        public ServiceStatus Status { get; }

        /// <summary>
        /// Gets the value, which is set only when the status is <see cref="ServiceStatus.Success"/>.
        /// </summary>
        public T? Value { get; }

        /// <summary>
        /// Gets the name of the request field that is wrong, when the status is not success.
        /// </summary>
        public string? Field { get; }

        /// <summary>
        /// Gets what is wrong, when the status is not success.
        /// </summary>
        public string? Message { get; }

        /// <summary>
        /// Creates a successful result.
        /// </summary>
        public static ServiceResult<T> Success(T value) => new(ServiceStatus.Success, value, null, null);

        /// <summary>
        /// Creates a not found result.
        /// </summary>
        public static ServiceResult<T> NotFound(string message) => new(ServiceStatus.NotFound, default, null, message);

        /// <summary>
        /// Creates an invalid request result.
        /// </summary>
        public static ServiceResult<T> Invalid(string field, string message) => new(ServiceStatus.Invalid, default, field, message);

        /// <summary>
        /// Creates a conflict result.
        /// </summary>
        public static ServiceResult<T> Conflict(string field, string message) => new(ServiceStatus.Conflict, default, field, message);
    }
}
