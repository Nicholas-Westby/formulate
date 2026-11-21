namespace Formulate.Core.FormHandlers
{
    // Namespaces.
    using System;

    /// <summary>
    /// Thrown when no installed form handler definition matches a handler's kind, for example
    /// after the extension that provided it was removed.
    /// </summary>
    /// <remarks>
    /// It derives from <see cref="NotSupportedException"/>, which the factory threw for this case before.
    /// </remarks>
    public sealed class FormHandlerKindNotFoundException : NotSupportedException
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="FormHandlerKindNotFoundException"/> class.
        /// </summary>
        /// <param name="kindId">The kind ID that no definition matches.</param>
        public FormHandlerKindNotFoundException(Guid kindId)
            : base($"No form handler definition matches the kind id '{kindId}'.")
        {
            KindId = kindId;
        }

        /// <summary>
        /// Gets the kind ID that no definition matches.
        /// </summary>
        public Guid KindId { get; }
    }
}
