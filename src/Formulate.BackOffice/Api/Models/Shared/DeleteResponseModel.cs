namespace Formulate.BackOffice.Api.Models.Shared
{
    using System;

    /// <summary>
    /// What a delete removed.
    /// </summary>
    public sealed class DeleteResponseModel
    {
        /// <summary>
        /// Gets the IDs of everything that was deleted, so open editors can be closed.
        /// </summary>
        public required Guid[] DeletedIds { get; init; }
    }
}
