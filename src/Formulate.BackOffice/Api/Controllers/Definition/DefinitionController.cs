namespace Formulate.BackOffice.Api.Controllers.Definition
{
    using System.Collections.Generic;
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Models.Definition;
    using Formulate.BackOffice.Api.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Lists the kinds of form field, form handler, validation, data values and layout, and the templates.
    /// </summary>
    /// <remarks>
    /// Property editors and pickers need these to show names and icons, so they need back office access
    /// only, not the Formulate section.
    /// </remarks>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/definition")]
    [ApiExplorerSettings(GroupName = "Definition")]
    public sealed class DefinitionController : FormulateApiControllerBase
    {
        private readonly IDefinitionApiService _service;

        /// <inheritdoc cref="DefinitionController"/>
        public DefinitionController(IDefinitionApiService service)
        {
            _service = service;
        }

        /// <summary>
        /// Gets the kinds of form field that can be added to a form.
        /// </summary>
        [HttpGet("form-field")]
        [ProducesResponseType<IEnumerable<FormFieldDefinitionModel>>(StatusCodes.Status200OK)]
        public IActionResult FormFields() => Ok(_service.GetFormFields());

        /// <summary>
        /// Gets the kinds of form handler that can be added to a form.
        /// </summary>
        [HttpGet("form-handler")]
        [ProducesResponseType<IEnumerable<FormHandlerDefinitionModel>>(StatusCodes.Status200OK)]
        public IActionResult FormHandlers() => Ok(_service.GetFormHandlers());

        /// <summary>
        /// Gets the kinds of validation.
        /// </summary>
        [HttpGet("validation")]
        [ProducesResponseType<IEnumerable<KindDefinitionModel>>(StatusCodes.Status200OK)]
        public IActionResult Validations() => Ok(_service.GetValidations());

        /// <summary>
        /// Gets the kinds of data values.
        /// </summary>
        [HttpGet("data-values")]
        [ProducesResponseType<IEnumerable<KindDefinitionModel>>(StatusCodes.Status200OK)]
        public IActionResult DataValues() => Ok(_service.GetDataValues());

        /// <summary>
        /// Gets the kinds of layout.
        /// </summary>
        [HttpGet("layout")]
        [ProducesResponseType<IEnumerable<KindDefinitionModel>>(StatusCodes.Status200OK)]
        public IActionResult Layouts() => Ok(_service.GetLayouts());

        /// <summary>
        /// Gets the templates a layout can use.
        /// </summary>
        [HttpGet("template")]
        [ProducesResponseType<IEnumerable<TemplateDefinitionModel>>(StatusCodes.Status200OK)]
        public IActionResult Templates() => Ok(_service.GetTemplates());
    }
}
