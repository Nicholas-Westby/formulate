namespace Formulate.BackOffice.Api.Services
{
    using System.Collections.Generic;
    using Formulate.BackOffice.Api.Models.Definition;

    /// <summary>
    /// Describes the kinds Formulate offers, for the Management API.
    /// </summary>
    public interface IDefinitionApiService
    {
        /// <summary>
        /// Gets the kinds of form field that can be added to a form: legacy kinds are left out.
        /// </summary>
        IReadOnlyList<FormFieldDefinitionModel> GetFormFields();

        /// <summary>
        /// Gets the kinds of form handler that can be added to a form: legacy kinds are left out.
        /// </summary>
        IReadOnlyList<FormHandlerDefinitionModel> GetFormHandlers();

        /// <summary>
        /// Gets every kind of validation, with legacy kinds flagged.
        /// </summary>
        IReadOnlyList<KindDefinitionModel> GetValidations();

        /// <summary>
        /// Gets every kind of data values, with legacy kinds flagged.
        /// </summary>
        IReadOnlyList<KindDefinitionModel> GetDataValues();

        /// <summary>
        /// Gets every kind of layout, with legacy kinds flagged.
        /// </summary>
        IReadOnlyList<KindDefinitionModel> GetLayouts();

        /// <summary>
        /// Gets the templates a layout can use.
        /// </summary>
        IReadOnlyList<TemplateDefinitionModel> GetTemplates();
    }
}
