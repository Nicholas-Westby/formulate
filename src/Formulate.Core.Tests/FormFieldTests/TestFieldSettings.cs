namespace Formulate.Core.Tests.FormFieldTests
{
    using System;
    using Formulate.Core.FormFields;
    using Formulate.Core.Validations;
    using Formulate.Core.Validations.Mandatory;
    using Moq;

    /// <summary>
    /// Field settings for tests, with the stored configuration given as JSON.
    /// </summary>
    internal sealed class TestFieldSettings : IFormFieldSettings
    {
        public Guid KindId { get; set; }
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Alias { get; set; } = "field";
        public string Name { get; set; } = "Field";
        public string Label { get; set; }
        public string Data { get; set; }
        public string Category { get; set; }
        public Guid[] Validations { get; set; } = Array.Empty<Guid>();

        /// <summary>
        /// A Mandatory validation as the field's definition would be given it.
        /// </summary>
        public static IValidation Mandatory(string message = "Required.")
        {
            return new MandatoryValidation(Mock.Of<IValidationSettings>(), new MandatoryValidationConfiguration { Message = message });
        }
    }
}
