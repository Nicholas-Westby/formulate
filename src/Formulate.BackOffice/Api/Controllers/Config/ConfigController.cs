namespace Formulate.BackOffice.Api.Controllers.Config
{
    using Asp.Versioning;
    using Formulate.BackOffice.Api.Models.Config;
    using Formulate.BackOffice.Api.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// Provides the settings the back office client needs.
    /// </summary>
    /// <remarks>
    /// Property editors need these as well as the Formulate section, so any signed-in back office user may read them.
    /// </remarks>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/config")]
    [ApiExplorerSettings(GroupName = "Config")]
    public sealed class ConfigController : FormulateApiControllerBase
    {
        private readonly IConfigApiService _service;

        /// <inheritdoc cref="ConfigController"/>
        public ConfigController(IConfigApiService service)
        {
            _service = service;
        }

        /// <summary>
        /// Gets the settings.
        /// </summary>
        [HttpGet]
        [ProducesResponseType<FormulateConfigResponseModel>(StatusCodes.Status200OK)]
        public IActionResult Get() => Ok(_service.Get());
    }
}
