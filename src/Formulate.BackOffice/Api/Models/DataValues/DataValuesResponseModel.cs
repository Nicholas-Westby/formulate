namespace Formulate.BackOffice.Api.Models.DataValues
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A data values item.
    /// </summary>
    public sealed class DataValuesResponseModel
    {
        /// <summary>
        /// Gets the ID.
        /// </summary>
        public required Guid Id { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        public required string Name { get; init; }

        /// <summary>
        /// Gets the alias.
        /// </summary>
        public string? Alias { get; init; }

        /// <summary>
        /// Gets the ID of the folder it is in; null when it is at the top of its tree.
        /// </summary>
        public Guid? ParentId { get; init; }

        /// <summary>
        /// Gets the ID of its kind.
        /// </summary>
        public required Guid KindId { get; init; }

        /// <summary>
        /// Gets a value saying the kind is a legacy one, whose items can be read and deleted but not changed.
        /// </summary>
        public bool IsLegacy { get; init; }

        /// <summary>
        /// Gets the kind-specific configuration, which can be any JSON value.
        /// </summary>
        public JsonElement? Configuration { get; init; }
    }
}
