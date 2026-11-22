namespace Formulate.Web.Components
{
    using Formulate.Core;
    using Formulate.Core.Layouts;
    using Formulate.Core.Templates;
    using Formulate.Core.Types;
    using Formulate.Web.Utilities;
    using Microsoft.AspNetCore.Html;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Mvc.ViewComponents;
    using Microsoft.Extensions.Logging;

    [ViewComponent]
    public sealed class FormulateFormViewComponent : ViewComponent
    {
        private readonly ILayoutEntityRepository _layoutEntityRepository;
        private readonly TemplateDefinitionCollection _templateDefinitions;
        private readonly IBuildFormLayoutRenderModel _buildFormLayoutRenderModel;
        private readonly ILogger<FormulateFormViewComponent> _logger;

        public FormulateFormViewComponent(ILayoutEntityRepository layoutEntityRepository, TemplateDefinitionCollection templateDefinitions, IBuildFormLayoutRenderModel buildFormLayoutRenderModel, ILogger<FormulateFormViewComponent> logger)
        {
            _layoutEntityRepository = layoutEntityRepository;
            _templateDefinitions = templateDefinitions;
            _buildFormLayoutRenderModel = buildFormLayoutRenderModel;
            _logger = logger;
        }

        public IViewComponentResult Invoke(FormLayout model)
        {
            if (model is null)
            {
                return EmptyResult();
            }

            var layout = _layoutEntityRepository.Get(model.LayoutId);

            if (layout is null)
            {
                return EmptyResult();
            }

            var template = _templateDefinitions.FirstOrDefault(layout.TemplateId);

            if (template is null)
            {
                if (layout.TemplateId is null)
                {
                    _logger.LogWarning(
                        "Layout {LayoutName} ({LayoutId}) is not shown because it has no template.",
                        layout.Name,
                        layout.Id);
                }
                else
                {
                    _logger.LogWarning(
                        "Layout {LayoutName} ({LayoutId}) is not shown because its template {TemplateId} is not installed.",
                        layout.Name,
                        layout.Id,
                        layout.TemplateId);
                }

                return EmptyResult();
            }

            var renderModel = _buildFormLayoutRenderModel.Build(model);

            if (renderModel is null)
            {
                return EmptyResult();
            }

            return View(template.ViewName, renderModel);
        }

        private static IViewComponentResult EmptyResult()
        {
            return new HtmlContentViewComponentResult(HtmlString.Empty);
        }
    }
}