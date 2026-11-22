namespace Formulate.Core.Tests.FormFieldTests
{
    // Namespaces.
    using FormFields;
    using System;
    using System.Collections.Generic;
    using Validations;

    public partial class FormFieldFactoryTests
    {
        private static class Constants
        {
            public const string MissingFormFieldKindId = "8D72D9E68AF44348A2F1FEE138902BA5";

            public const string TestFormFieldKindId = "B5BDFE470A07446CACA733EA99B902F4";

            public const string UnreadableFormFieldKindId = "0C2F0F5B4D6A4E0B9C1E2A3B4C5D6E7F";
        }

        /// <summary>
        /// A kind that builds its field but fails to describe the configuration for the back office.
        /// </summary>
        private sealed class UnreadableFormFieldDefinition : FormFieldDefinition<TestFormField>
        {
            public override Guid KindId => Guid.Parse(Constants.UnreadableFormFieldKindId);

            public override string Name => "Unreadable Form Field";

            public override string Icon => "icon-test-field";

            public override string EditorAlias => "formulate-unreadable-field";

            public override FormField CreateField(IFormFieldSettings settings)
            {
                return new TestFormField(settings);
            }

            public override object GetBackOfficeConfiguration(IFormFieldSettings settings)
            {
                throw new InvalidOperationException("The configuration can not be read.");
            }
        }

        private sealed class TestFormFieldSettings : IFormFieldSettings
        {
            public Guid KindId { get; set; }
            public Guid Id { get; set; }
            public string Alias { get; set; }
            public string Name { get; set; }
            public string Label { get; set; }
            public string Data { get; set; }
            public string Category { get; set; }
            public Guid[] Validations { get; set; }
        }

        private sealed class TestFormFieldDefinition : FormFieldDefinition<TestFormField>
        {
            public override Guid KindId => Guid.Parse(Constants.TestFormFieldKindId);

            public override string Name => "Text Form Field";

            public override string Icon => "icon-test-field";

            public override string EditorAlias => "formulate-test-field";

            public override string Category => "Test";

            public override FormField CreateField(IFormFieldSettings settings)
            {
                return new TestFormField(settings);
            }
        }

        private sealed class TestFormField : FormField
        {
            public TestFormField(IFormFieldSettings settings) : base(settings)
            {
            }

            public TestFormField(IFormFieldSettings settings, IReadOnlyCollection<IValidation> validations) : base(settings, validations)
            {
            }
        }
    }
}