namespace Formulate.Extensions.StoreData
{
    using Formulate.Extensions.StoreData.Services;
    using Formulate.Extensions.StoreData.Utilities;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Umbraco.Cms.Core.Composing;
    using Umbraco.Cms.Core.DependencyInjection;

    public sealed class StoreDataComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.Services.Configure<StoreDataSettings>(builder.Config.GetSection(StoreDataSettings.SectionName));
            builder.Services.AddSingleton<UploadFolders>();

            builder.Services.AddScoped<ISubmissionDatabase, ScopedSubmissionDatabase>();
            builder.Services.AddScoped<ISubmissionRepository, SubmissionRepository>();
            builder.Services.AddScoped<IPageUrlResolver, PageUrlResolver>();

            builder.Services.AddScoped<ISubmissionQueryService, SubmissionQueryService>();

            builder.Services.AddScoped<IStoreFields, StoreFields>();
            builder.Services.AddScoped<IStoreFiles, StoreFiles>();
            builder.Services.AddScoped<IStoreData, StoreData>();
        }
    }
}
