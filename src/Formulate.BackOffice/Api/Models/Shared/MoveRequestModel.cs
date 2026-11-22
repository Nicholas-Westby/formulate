namespace Formulate.BackOffice.Api.Models.Shared
{
    using System;
    using System.Text.Json.Serialization;
    using Formulate.BackOffice.Api.Json;

    /// <summary>
    /// Moves an item.
    /// </summary>
    public sealed class MoveRequestModel
    {
        /// <summary>
        /// Gets the ID of the folder to move into; null moves to the top of the item's own tree.
        /// </summary>
        [JsonConverter(typeof(LenientGuidConverter))]
        public Guid? TargetId { get; init; }
    }
}
