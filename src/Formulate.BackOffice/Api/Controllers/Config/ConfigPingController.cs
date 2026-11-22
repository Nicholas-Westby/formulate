namespace Formulate.BackOffice.Api.Controllers.Config
{
    using Asp.Versioning;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Management.Routing;

    /// <summary>
    /// TEMPORARY. Proves that the Formulate OpenAPI document and back office authentication work.
    /// </summary>
    /// <remarks>
    /// Delete this file when the configuration controller (GET formulate/config) is added.
    /// </remarks>
    [ApiVersion("1.0")]
    [VersionedApiBackOfficeRoute("formulate/config")]
    [ApiExplorerSettings(GroupName = "Config")]
    public sealed class ConfigPingController : FormulateApiControllerBase
    {
        /// <summary>
        /// Answers any signed-in back office user.
        /// </summary>
        [HttpGet("ping")]
        [ProducesResponseType<PingResponseModel>(StatusCodes.Status200OK)]
        public IActionResult Ping()
        {
            return Ok(new PingResponseModel { Ok = true });
        }
    }

    /// <summary>
    /// TEMPORARY. The response of <see cref="ConfigPingController.Ping"/>.
    /// </summary>
    public sealed class PingResponseModel
    {
        /// <summary>
        /// Always true.
        /// </summary>
        public bool Ok { get; init; }
    }
}
