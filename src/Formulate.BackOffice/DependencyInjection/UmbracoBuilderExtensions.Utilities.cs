namespace Formulate.BackOffice.DependencyInjection
{
    // Namespaces.
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Services;
    using Formulate.BackOffice.Persistence;
    using Formulate.BackOffice.Utilities;
    using Formulate.Core.Utilities.Submissions;
    using Microsoft.Extensions.DependencyInjection;
    using System.Linq;
    using Umbraco.Cms.Core.DependencyInjection;

    public partial class UmbracoBuilderExtensions
    {
        /// <summary>
        /// Adds Formulate Utilities.
        /// </summary>
        /// <param name="builder">
        /// The Umbraco builder.
        /// </param>
        /// <returns>
        /// The current <see cref="IUmbracoBuilder"/>.
        /// </returns>
        private static IUmbracoBuilder AddFormulateUtilities(
            this IUmbracoBuilder builder)
        {
            builder.Services.AddScoped<ITreeEntityRepository, TreeEntityRepository>();
            builder.Services.AddScoped<IFormulateTreeService, FormulateTreeService>();
            builder.Services.AddScoped<IFormApiService, FormApiService>();
            builder.Services.AddScoped<ILayoutApiService, LayoutApiService>();
            builder.Services.AddScoped<IValidationApiService, ValidationApiService>();
            builder.Services.AddScoped<IDataValuesApiService, DataValuesApiService>();
            builder.Services.AddScoped<IFolderApiService, FolderApiService>();
            builder.Services.AddScoped<IMoveService, MoveService>();
            builder.Services.AddScoped<IDefinitionApiService, DefinitionApiService>();
            builder.Services.AddScoped<ICreateOptionsApiService, CreateOptionsApiService>();
            builder.Services.AddScoped<IConfigApiService, ConfigApiService>();
            builder.Services.AddScoped<ConfigurationJson>();

            builder.Services.AddSingleton<IGetDefaultTemplateId, GetDefaultTemplateId>();

            return builder;
        }
    }
}
