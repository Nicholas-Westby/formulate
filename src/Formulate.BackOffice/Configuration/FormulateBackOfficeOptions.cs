using System;
using Formulate.Core.Templates;

namespace Formulate.BackOffice.Configuration
{
    public sealed class FormulateBackOfficeOptions
    {
        public const string SectionName = "Formulate:BackOffice";

        /// <summary>
        /// Gets the default template ID to be used when creating new layouts.
        /// </summary>
        /// <remarks>If no value is provided the first registered <see cref="ITemplateDefinition"/>'s <see cref="KindId"/> will be used instead.</remarks>
        public Guid? DefaultTemplateId { get; set; }
    }
}
